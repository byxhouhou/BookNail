const app = getApp();

Page({
  data: {
    username: "",
    password: "",
    loggedIn: false
  },

  onShow() {
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

  login() {
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

    if (!app.verifyOwner(username, password)) {
      wx.showToast({
        title: "账号或密码错误",
        icon: "none"
      });
      return;
    }

    app.setOwnerLoggedIn(true);
    this.setData({
      loggedIn: true,
      password: ""
    });
    wx.navigateTo({
      url: "/pages/owner-appointments/owner-appointments"
    });
  }
});
