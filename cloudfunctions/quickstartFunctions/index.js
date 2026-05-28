const cloud = require("wx-server-sdk");
const crypto = require("crypto");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const APPOINTMENTS_COLLECTION = "appointments";
const OWNERS_COLLECTION = "owners";
const MAX_LIMIT = 100;
const DEFAULT_OWNER = {
  username: "mishiqi",
  password: "mishiqi8888@"
};

const success = (data = null) => ({
  success: true,
  data
});

const fail = (errMsg) => ({
  success: false,
  errMsg
});

const hashPassword = (password) => crypto
  .createHash("sha256")
  .update(`${password}`)
  .digest("hex");

const ensureCollection = async (name) => {
  try {
    await db.createCollection(name);
  } catch (error) {
    const message = error.errMsg || error.message || "";
    if (!/exist|already|collection already exists/i.test(message)) {
      console.warn("create collection skipped", error);
    }
  }
};

const getAllAppointments = async (where = {}) => {
  await ensureCollection(APPOINTMENTS_COLLECTION);

  const result = await db
    .collection(APPOINTMENTS_COLLECTION)
    .where(where)
    .limit(MAX_LIMIT)
    .get();

  return result.data || [];
};

const ensureOwnerSeed = async () => {
  await ensureCollection(OWNERS_COLLECTION);

  const result = await db
    .collection(OWNERS_COLLECTION)
    .where({
      username: DEFAULT_OWNER.username
    })
    .limit(1)
    .get();

  if (result.data.length) {
    return success({
      username: DEFAULT_OWNER.username,
      existed: true
    });
  }

  await db.collection(OWNERS_COLLECTION).add({
    data: {
      username: DEFAULT_OWNER.username,
      passwordHash: hashPassword(DEFAULT_OWNER.password),
      role: "owner",
      enabled: true,
      createdAt: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    }
  });

  return success({
    username: DEFAULT_OWNER.username,
    existed: false
  });
};

const loginOwner = async (event) => {
  await ensureOwnerSeed();

  const { username, password } = event.data || {};
  if (!username || !password) {
    return fail("请输入账号和密码");
  }

  const result = await db
    .collection(OWNERS_COLLECTION)
    .where({
      username: `${username}`.trim()
    })
    .limit(1)
    .get();

  if (!result.data.length) {
    return fail("账号或密码错误");
  }

  const owner = result.data[0];
  if (!owner.enabled) {
    return fail("账号已停用");
  }

  if (owner.passwordHash !== hashPassword(password)) {
    return fail("账号或密码错误");
  }

  return success({
    username: owner.username,
    role: owner.role || "owner"
  });
};

const ensureAppointmentSeed = async () => {
  await ensureCollection(APPOINTMENTS_COLLECTION);
  await ensureOwnerSeed();
  return success([]);
};

const listAppointments = async () => {
  const appointments = await getAllAppointments();
  return success(appointments);
};

const listAppointmentsByContact = async (event) => {
  const contact = ((event.data || {}).contact || "").trim();

  if (!contact) {
    return success([]);
  }

  const appointments = await getAllAppointments({
    phone: contact
  });
  return success(appointments);
};

const addAppointment = async (event) => {
  await ensureCollection(APPOINTMENTS_COLLECTION);

  const appointment = event.data || {};
  const requiredFields = ["date", "time", "serviceId", "serviceName", "name", "phone"];
  const missingField = requiredFields.find((field) => !appointment[field]);

  if (missingField) {
    return fail("预约信息不完整");
  }

  const existing = await db
    .collection(APPOINTMENTS_COLLECTION)
    .where({
      date: appointment.date,
      time: appointment.time
    })
    .limit(1)
    .get();

  if (existing.data.length) {
    return fail("该时段已被占用");
  }

  const wxContext = cloud.getWXContext();
  const result = await db.collection(APPOINTMENTS_COLLECTION).add({
    data: {
      date: appointment.date,
      time: appointment.time,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      priceLabel: appointment.priceLabel || "",
      name: appointment.name,
      phone: appointment.phone,
      note: appointment.note || "",
      createdAt: appointment.createdAt || new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      openid: wxContext.OPENID,
      isSeed: false,
      isBlocked: Boolean(appointment.isBlocked)
    }
  });

  return success({
    id: result._id
  });
};

const deleteAppointment = async (event) => {
  await ensureCollection(APPOINTMENTS_COLLECTION);

  const id = (event.data || {}).id;
  if (!id) {
    return fail("缺少预约 ID");
  }

  await db.collection(APPOINTMENTS_COLLECTION).doc(id).remove();

  return success({
    id
  });
};

const getOpenId = async () => {
  const wxContext = cloud.getWXContext();
  return success({
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  });
};

exports.main = async (event) => {
  try {
    switch (event.type) {
      case "ensureOwnerSeed":
        return await ensureOwnerSeed();
      case "loginOwner":
        return await loginOwner(event);
      case "ensureAppointmentSeed":
        return await ensureAppointmentSeed(event);
      case "listAppointments":
        return await listAppointments();
      case "listAppointmentsByContact":
        return await listAppointmentsByContact(event);
      case "addAppointment":
        return await addAppointment(event);
      case "deleteAppointment":
        return await deleteAppointment(event);
      case "getOpenId":
        return await getOpenId();
      default:
        return fail("未知的云函数类型");
    }
  } catch (error) {
    console.error("quickstartFunctions error", error);
    return fail(error.errMsg || error.message || JSON.stringify(error) || "云函数执行失败");
  }
};
