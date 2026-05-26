const app = getApp();
const { getDateOptions } = require("../../utils/date");

Page({
  data: {
    appointments: [],
    dateOptions: [],
    selectedRestDate: "",
    selectedRestDateLabel: "",
    selectedRestTime: "",
    restTimeSlots: []
  },

  onLoad() {
    const dateOptions = getDateOptions(10);
    const selectedRestDate = dateOptions[0].value;

    this.setData({
      dateOptions,
      selectedRestDate,
      selectedRestDateLabel: `${dateOptions[0].week} ${dateOptions[0].monthDay}`,
      restTimeSlots: this.buildRestSlots([])
    });
  },

  onShow() {
    if (!app.isOwnerLoggedIn()) {
      wx.switchTab({
        url: "/pages/owner-login/owner-login"
      });
      return;
    }

    this.loadAppointments();
  },

  async loadAppointments() {
    try {
      const allAppointments = (await app.getAppointments()).map((item) => ({
        ...item,
        isSeed: item.isSeed || `${item.id}`.indexOf("seed-") === 0,
        isBlocked: this.isRestAppointment(item)
      }));

      await this.removeExpiredAppointments(allAppointments);

      const cutoffDate = app.formatDate(-10);
      const appointments = allAppointments
        .filter((item) => item.date >= cutoffDate)
        .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

      this.setData({
        appointments,
        restTimeSlots: this.buildRestSlots(appointments)
      });
    } catch (error) {
      wx.showToast({
        title: "加载预约失败",
        icon: "none"
      });
    }
  },

  async removeExpiredAppointments(appointments) {
    const cutoffDate = app.formatDate(-10);
    const expired = appointments.filter((item) => item.date < cutoffDate && !item.isSeed);

    for (let i = 0; i < expired.length; i++) {
      await app.deleteAppointment(expired[i].id);
    }
  },

  buildRestSlots(appointments) {
    const occupied = {};

    appointments
      .filter((item) => item.date === this.data.selectedRestDate)
      .forEach((item) => {
        const isBlocked = this.isRestAppointment(item);
        occupied[item.time] = {
          id: item.id,
          isBlocked,
          statusText: isBlocked ? "休息" : "客人预约"
        };
      });

    return app.globalData.timeSlots.map((time) => ({
      time,
      booked: Boolean(occupied[time]),
      id: occupied[time] ? occupied[time].id : "",
      isBlocked: occupied[time] ? occupied[time].isBlocked : false,
      statusText: occupied[time] ? occupied[time].statusText : "可休"
    }));
  },

  isRestAppointment(item) {
    return Boolean(
      item.isBlocked ||
      item.serviceId === "owner-rest" ||
      item.serviceName === "店主休息" ||
      item.note === "休息时段" ||
      item.note === "全天休息"
    );
  },

  onSelectRestDate(event) {
    const selectedRestDate = event.currentTarget.dataset.date;
    const selected = this.data.dateOptions.find((item) => item.value === selectedRestDate);

    this.setData({
      selectedRestDate,
      selectedRestDateLabel: `${selected.week} ${selected.monthDay}`,
      selectedRestTime: ""
    });
    this.loadAppointments();
  },

  onSelectRestTime(event) {
    this.setData({
      selectedRestTime: event.currentTarget.dataset.time
    });
  },

  setRestSlot() {
    if (!this.data.selectedRestDate || !this.data.selectedRestTime) {
      wx.showToast({
        title: "请选择休息日期和时间",
        icon: "none"
      });
      return;
    }

    const selectedSlot = this.getSelectedRestSlot();
    if (selectedSlot && selectedSlot.booked) {
      wx.showToast({
        title: "该时段已被占用",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "设为休息",
      content: `确定设置 ${this.data.selectedRestDate} ${this.data.selectedRestTime} 休息吗？`,
      confirmColor: "#d75f7a",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        wx.showLoading({
          title: "保存中"
        });

        try {
          await this.createRestAppointment(this.data.selectedRestTime, "休息时段");
          wx.hideLoading();
          wx.showToast({
            title: "已设置休息",
            icon: "success"
          });
          this.setData({
            selectedRestTime: ""
          });
          this.loadAppointments();
        } catch (error) {
          wx.hideLoading();
          wx.showToast({
            title: error.message || "设置失败",
            icon: "none"
          });
        }
      }
    });
  },

  cancelSelectedSlot() {
    const selectedSlot = this.getSelectedRestSlot();

    if (!selectedSlot) {
      wx.showToast({
        title: "请选择时间段",
        icon: "none"
      });
      return;
    }

    if (!selectedSlot.booked || !selectedSlot.id) {
      wx.showToast({
        title: "该时段没有占用",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: selectedSlot.isBlocked ? "取消休息" : "取消预约",
      content: `确定取消 ${this.data.selectedRestDate} ${selectedSlot.time} 的${selectedSlot.isBlocked ? "休息" : "预约"}吗？`,
      confirmColor: "#d75f7a",
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        app.deleteAppointment(selectedSlot.id).then(() => {
          wx.showToast({
            title: selectedSlot.isBlocked ? "已释放休息" : "已取消预约",
            icon: "success"
          });
          this.setData({
            selectedRestTime: ""
          });
          this.loadAppointments();
        }).catch(() => {
          wx.showToast({
            title: "取消失败",
            icon: "none"
          });
        });
      }
    });
  },

  getSelectedRestSlot() {
    return this.data.restTimeSlots.find((item) => item.time === this.data.selectedRestTime);
  },

  setFullDayRest() {
    const availableSlots = this.data.restTimeSlots.filter((item) => !item.booked);

    if (!availableSlots.length) {
      wx.showToast({
        title: "当天已无可休时段",
        icon: "none"
      });
      return;
    }

    wx.showModal({
      title: "全天休息",
      content: `确定设置 ${this.data.selectedRestDate} 全天休息吗？`,
      confirmColor: "#d75f7a",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        wx.showLoading({
          title: "保存中"
        });

        try {
          for (let i = 0; i < availableSlots.length; i++) {
            await this.createRestAppointment(availableSlots[i].time, "全天休息", i);
          }

          wx.hideLoading();
          wx.showToast({
            title: "已设置全天休息",
            icon: "success"
          });
          this.setData({
            selectedRestTime: ""
          });
          this.loadAppointments();
        } catch (error) {
          wx.hideLoading();
          wx.showToast({
            title: error.message || "设置失败",
            icon: "none"
          });
        }
      }
    });
  },

  createRestAppointment(time, note, index = 0) {
    return app.saveAppointment({
      id: `rest-${Date.now()}-${index}`,
      date: this.data.selectedRestDate,
      time,
      serviceId: "owner-rest",
      serviceName: "店主休息",
      priceLabel: "",
      name: "店主",
      phone: "-",
      note,
      createdAt: new Date().toLocaleString("zh-CN"),
      isBlocked: true
    });
  },

  reload() {
    this.loadAppointments();
    wx.showToast({
      title: "已刷新",
      icon: "success"
    });
  },

  logout() {
    app.setOwnerLoggedIn(false);
    wx.switchTab({
      url: "/pages/owner-login/owner-login"
    });
  },

  deleteAppointment(event) {
    const id = event.currentTarget.dataset.id;
    const isBlocked = event.currentTarget.dataset.blocked;

    wx.showModal({
      title: isBlocked ? "取消休息" : "取消预约",
      content: isBlocked ? "确定释放这个休息时段吗？" : "确定取消这个预约吗？",
      confirmColor: "#d75f7a",
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        app.deleteAppointment(id).then(() => {
          wx.showToast({
            title: isBlocked ? "已释放" : "已取消",
            icon: "success"
          });
          this.loadAppointments();
        }).catch(() => {
          wx.showToast({
            title: isBlocked ? "释放失败" : "取消失败",
            icon: "none"
          });
        });
      }
    });
  }
});
