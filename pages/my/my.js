const app = getApp();

Page({
  data: {
    keyword: "",
    hasSearched: false,
    results: []
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

    if (this.data.hasSearched) {
      this.queryAppointments();
    }
  },

  onInput(event) {
    this.setData({
      keyword: event.detail.value
    });
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

  async queryAppointments() {
    const keyword = this.data.keyword.trim();

    if (!keyword) {
      wx.showToast({
        title: "请输入微信号或手机号",
        icon: "none"
      });
      return;
    }

    wx.showLoading({
      title: "查询中"
    });

    try {
      const results = await app.getAppointmentsByContact(keyword);
      wx.hideLoading();
      this.setData({
        hasSearched: true,
        results: results.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: "查询失败",
        icon: "none"
      });
    }
  },

  cancelAppointment(event) {
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
          this.queryAppointments();
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
