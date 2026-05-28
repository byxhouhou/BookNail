const app = getApp();

Page({
  data: {
    username: "",
    password: "",
    loggedIn: false
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

    this.setData({
      loggedIn: app.isOwnerLoggedIn()
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;

    this.setData({
      [field]: event.detail.value
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

  async login() {
    if (this.data.loggedIn) {
      wx.navigateTo({
        url: "/pages/owner-appointments/owner-appointments"
      });
      return;
    }

    const { username, password } = this.data;

    if (!username.trim() || !password) {
      wx.showToast({
        title: "请输入账号和密码",
        icon: "none"
      });
      return;
    }

    wx.showLoading({
      title: "登录中"
    });

    try {
      await app.loginOwner(username, password);
      app.setOwnerLoggedIn(true);
      wx.hideLoading();
      this.setData({
        loggedIn: true,
        password: ""
      });
      wx.navigateTo({
        url: "/pages/owner-appointments/owner-appointments"
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || "登录失败",
        icon: "none"
      });
    }
  }
});
