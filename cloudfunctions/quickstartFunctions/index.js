const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const APPOINTMENTS_COLLECTION = "appointments";
const MAX_LIMIT = 100;

const success = (data = null) => ({
  success: true,
  data
});

const fail = (errMsg) => ({
  success: false,
  errMsg
});

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

const ensureAppointmentSeed = async (event) => {
  await ensureCollection(APPOINTMENTS_COLLECTION);

  const { date, seedAppointments = [] } = event.data || {};
  if (!date || !seedAppointments.length) {
    return success([]);
  }

  const seedResult = await db
    .collection(APPOINTMENTS_COLLECTION)
    .where({
      isSeed: true,
      date
    })
    .limit(1)
    .get();

  if (seedResult.data.length) {
    return success(seedResult.data);
  }

  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  for (let i = 0; i < seedAppointments.length; i++) {
    const item = seedAppointments[i];
    await db.collection(APPOINTMENTS_COLLECTION).add({
      data: {
        ...item,
        date,
        createdAt: now,
        isSeed: true
      }
    });
  }

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
    return fail("该时段已被预约");
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
