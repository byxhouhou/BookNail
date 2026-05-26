const app = getApp();

Page({
  data: {
    appointments: []
  },

  onShow() {
    this.loadAppointments();
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
