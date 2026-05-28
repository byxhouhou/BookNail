const app = getApp();

Page({
  data: {
    appointments: []
  },

  onLoad() {
    this.enableShareMenu();
  },

  enableShareMenu() {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ["shareAppMessage", "shareTimeline"]
      });
    }
  },

  onShow() {
    this.enableShareMenu();

    this.loadAppointments();
  },

  onShareAppMessage() {
    return {
      title: "指尖花园美甲预约",
      path: "/pages/booking/booking"
    };
  },

  onShareTimeline() {
    return {
      title: "指尖花园美甲预约",
      query: ""
    };
  },

  async loadAppointments() {
    try {
      const appointments = (await app.getAppointments())
        .slice()
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
        .map((item) => ({
          ...item,
          isSeed: item.isSeed || `${item.id}`.indexOf("seed-") === 0
        }));

      this.setData({
        appointments
      });
    } catch (error) {
      wx.showToast({
        title: "加载预约失败",
        icon: "none"
      });
    }
  },

  deleteAppointment(event) {
    const id = event.currentTarget.dataset.id;

    wx.showModal({
      title: "取消预约",
      content: "确定取消这个预约吗？",
      confirmColor: "#d75f7a",
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        app.deleteAppointment(id).then(() => {
          wx.showToast({
            title: "已取消",
            icon: "success"
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
  }
});
