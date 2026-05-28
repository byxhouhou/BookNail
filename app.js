App({
  globalData: {
    storageKey: "nailAppointments",
    useCloud: true,
    cloudEnvId: "",
    cloudFunctionName: "quickstartFunctions",
    ownerSessionKey: "nailOwnerLoggedIn",
    timeSlots: [
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00"
    ],
    pricingCatalog: {
      "基础项目": [
        { name: "甲片延长（半贴）", price: 30000 },
        { name: "纯色", price: 35000 }
      ],
      "设计效果": [
        { name: "猫眼", price: 10000 },
        {
          name: "蹭粉",
          price: 10000,
          options: ["月光粉", "镀晶粉", "魔镜粉"]
        },
        {
          name: "渐变",
          full: 10000,
          single: 1000
        },
        {
          name: "晕染",
          full: 10000,
          single: 1000
        },
        {
          name: "法式",
          full: 18000,
          single: 1800
        }
      ],
      "装饰": [
        { name: "手拼大钻球", price: 5000, unit: "个" },
        { name: "小钻球", price: 2500, unit: "个" },
        { name: "平底拼钻", min: 2000, max: 5000 }
      ]
    }
  },

  onLaunch() {
    if (wx.cloud) {
      const cloudConfig = {
        traceUser: true
      };

      if (this.globalData.cloudEnvId) {
        cloudConfig.env = this.globalData.cloudEnvId;
      }

      wx.cloud.init(cloudConfig);
    } else {
      this.globalData.useCloud = false;
    }
  },

  formatDate(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  async callCloud(type, data = {}) {
    try {
      const callOptions = {
        name: this.globalData.cloudFunctionName,
        data: {
          type,
          data
        }
      };

      if (this.globalData.cloudEnvId) {
        callOptions.config = {
          env: this.globalData.cloudEnvId
        };
      }

      const result = await wx.cloud.callFunction(callOptions);

      console.log("[cloud result]", type, result);

      if (!result.result || result.result.success === false) {
        const errMsg = (result.result && result.result.errMsg) || "云端返回失败";
        throw new Error(errMsg);
      }

      return result.result.data;
    } catch (error) {
      console.error("[cloud error]", type, error);
      throw new Error(error.errMsg || error.message || "云端请求失败");
    }
  },

  normalizeAppointment(item) {
    return {
      ...item,
      id: item._id || item.id
    };
  },

  async getAppointments() {
    if (this.globalData.useCloud && wx.cloud) {
      const appointments = await this.callCloud("listAppointments");
      return appointments.map((item) => this.normalizeAppointment(item));
    }

    return wx.getStorageSync(this.globalData.storageKey) || [];
  },

  async getAppointmentsByContact(contact) {
    if (this.globalData.useCloud && wx.cloud) {
      const appointments = await this.callCloud("listAppointmentsByContact", {
        contact
      });
      return appointments.map((item) => this.normalizeAppointment(item));
    }

    return (wx.getStorageSync(this.globalData.storageKey) || []).filter((item) => item.phone === contact);
  },

  async saveAppointment(appointment) {
    if (this.globalData.useCloud && wx.cloud) {
      return await this.callCloud("addAppointment", appointment);
    }

    const appointments = wx.getStorageSync(this.globalData.storageKey) || [];
    wx.setStorageSync(this.globalData.storageKey, [appointment].concat(appointments));
    return { id: appointment.id };
  },

  async deleteAppointment(id) {
    if (this.globalData.useCloud && wx.cloud) {
      return await this.callCloud("deleteAppointment", {
        id
      });
    }

    const appointments = (wx.getStorageSync(this.globalData.storageKey) || []).filter((item) => item.id !== id);
    wx.setStorageSync(this.globalData.storageKey, appointments);
    return { id };
  },

  async loginOwner(username, password) {
    return await this.callCloud("loginOwner", {
      username: username.trim(),
      password
    });
  },

  isOwnerLoggedIn() {
    return Boolean(wx.getStorageSync(this.globalData.ownerSessionKey));
  },

  setOwnerLoggedIn(value) {
    if (value) {
      wx.setStorageSync(this.globalData.ownerSessionKey, true);
      return;
    }

    wx.removeStorageSync(this.globalData.ownerSessionKey);
  }
});
