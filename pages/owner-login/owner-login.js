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
