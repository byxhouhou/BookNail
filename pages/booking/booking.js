const app = getApp();
const { getDateOptions } = require("../../utils/date");

Page({
  data: {
    dateOptions: [],
    selectedDate: "",
    selectedDateLabel: "",
    serviceGroups: [],
    selectedServiceIds: [],
    selectedServiceNames: "",
    selectedPriceLabel: "",
    selectedTime: "",
    selectedTimeBooked: false,
    timeSlots: [],
    availableCount: 0,
    form: {
      name: "",
      phone: "",
      note: ""
    },
    canSubmit: false
  },

  onLoad() {
    this.enableShareMenu();

    const dateOptions = getDateOptions(10);
    const selectedDate = dateOptions[0].value;
    const selectedDateLabel = `${dateOptions[0].week} ${dateOptions[0].monthDay}`;

    this.setData({
      dateOptions,
      selectedDate,
      selectedDateLabel,
      serviceGroups: this.buildServiceGroups([]),
      timeSlots: this.buildSlots([]),
      availableCount: app.globalData.timeSlots.length
    });
    this.refreshSlots();
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

    if (this.data.selectedDate) {
      this.refreshSlots();
    }
  },

  onSelectDate(event) {
    const selectedDate = event.currentTarget.dataset.date;
    const selected = this.data.dateOptions.find((item) => item.value === selectedDate);

    this.setData({
      selectedDate,
      selectedDateLabel: `${selected.week} ${selected.monthDay}`,
      selectedTime: "",
      selectedTimeBooked: false,
      canSubmit: this.getSubmitState({
        selectedDate,
        selectedTime: ""
      })
    });
    this.refreshSlots();
  },

  onSelectTime(event) {
    const { time, booked } = event.currentTarget.dataset;

    if (booked) {
      wx.showToast({
        title: "该时段已被占用",
        icon: "none"
      });
      return;
    }

    this.setData({
      selectedTime: time,
      selectedTimeBooked: false,
      canSubmit: this.getSubmitState({
        selectedTime: time
      })
    });
  },

  onToggleService(event) {
    const id = event.currentTarget.dataset.id;
    const selectedServiceIds = this.data.selectedServiceIds.slice();
    const index = selectedServiceIds.indexOf(id);

    if (index === -1) {
      selectedServiceIds.push(id);
    } else {
      selectedServiceIds.splice(index, 1);
    }

    const summary = this.getServiceSummary(selectedServiceIds);

    this.setData({
      selectedServiceIds,
      serviceGroups: this.buildServiceGroups(selectedServiceIds),
      selectedServiceNames: summary.names,
      selectedPriceLabel: summary.priceLabel,
      canSubmit: this.getSubmitState({
        selectedServiceIds
      })
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const form = {
      ...this.data.form,
      [field]: event.detail.value
    };

    this.setData({
      [`form.${field}`]: event.detail.value,
      canSubmit: this.getSubmitState({
        form
      })
    });
  },

  async refreshSlots() {
    try {
      const appointments = await app.getAppointments();
      const occupied = appointments
        .filter((item) => item.date === this.data.selectedDate)
        .map((item) => item.time);
      const timeSlots = this.buildSlots(occupied);
      const selectedSlot = timeSlots.find((item) => item.time === this.data.selectedTime);

      this.setData({
        timeSlots,
        selectedTimeBooked: selectedSlot ? selectedSlot.booked : false,
        availableCount: timeSlots.filter((item) => !item.booked).length,
        canSubmit: this.getSubmitState({
          selectedTime: selectedSlot && !selectedSlot.booked ? selectedSlot.time : ""
        })
      });
    } catch (error) {
      const timeSlots = this.buildSlots([]);
      this.setData({
        timeSlots,
        availableCount: timeSlots.length
      });
      wx.showToast({
        title: "云端加载失败，已显示可约时段",
        icon: "none"
      });
    }
  },

  buildSlots(occupied) {
    return app.globalData.timeSlots.map((time) => ({
      time,
      booked: occupied.indexOf(time) !== -1
    }));
  },

  buildServiceGroups(selectedServiceIds) {
    return this.getCatalogGroups().map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        checked: selectedServiceIds.indexOf(item.id) !== -1
      }))
    }));
  },

  getCatalogGroups() {
    const catalog = app.globalData.pricingCatalog;

    return Object.keys(catalog).map((groupName) => ({
      id: this.toId(groupName),
      name: groupName,
      singleColumn: groupName === "设计效果" || groupName === "装饰",
      items: catalog[groupName].reduce((list, item) => list.concat(this.expandCatalogItem(groupName, item)), [])
    }));
  },

  expandCatalogItem(groupName, item) {
    if (item.options && item.options.length) {
      return [{
        id: this.toId(`${groupName}-${item.name}`),
        name: item.name,
        detail: item.options.join(" / "),
        priceLabel: this.getPriceLabel(item.price),
        priceValue: item.price
      }];
    }

    if (item.full !== undefined || item.single !== undefined) {
      return [{
        id: this.toId(`${groupName}-${item.name}`),
        name: item.name,
        detail: `全手 ${this.getPriceLabel(item.full)} / 单根 ${this.getPriceLabel(item.single)}`,
        priceLabel: this.getPriceLabel(item.full),
        priceValue: item.full
      }];
    }

    if (item.min !== undefined && item.max !== undefined) {
      return [{
        id: this.toId(`${groupName}-${item.name}`),
        name: item.name,
        priceLabel: `${item.min}~${item.max}₩${item.unit ? `/${item.unit}` : "/个"}`,
        priceValue: item.min,
        variable: true
      }];
    }

    return [{
      id: this.toId(`${groupName}-${item.name}`),
      name: item.name,
      priceLabel: this.getPriceLabel(item.price, item.unit),
      priceValue: item.price
    }];
  },

  getSelectedServices(selectedServiceIds) {
    const items = [];

    this.getCatalogGroups().forEach((group) => {
      group.items.forEach((item) => {
        if (selectedServiceIds.indexOf(item.id) !== -1) {
          items.push(item);
        }
      });
    });

    return items;
  },

  getServiceSummary(selectedServiceIds) {
    const selectedServices = this.getSelectedServices(selectedServiceIds);
    const total = selectedServices.reduce((sum, item) => sum + item.priceValue, 0);
    const hasVariablePrice = selectedServices.some((item) => item.variable);

    return {
      names: selectedServices.map((item) => item.name).join(" + "),
      priceLabel: total ? `${this.formatPrice(total)}₩${hasVariablePrice ? "起" : ""}` : ""
    };
  },

  getPriceLabel(price, unit) {
    return `${this.formatPrice(price)}₩${unit ? `/${unit}` : ""}`;
  },

  formatPrice(value) {
    return `${value}`;
  },

  toId(value) {
    return value
      .replace(/[（）()]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  },

  getSubmitState(nextData = {}) {
    const selectedDate = nextData.selectedDate !== undefined ? nextData.selectedDate : this.data.selectedDate;
    const selectedTime = nextData.selectedTime !== undefined ? nextData.selectedTime : this.data.selectedTime;
    const selectedServiceIds =
      nextData.selectedServiceIds !== undefined ? nextData.selectedServiceIds : this.data.selectedServiceIds;
    const form = nextData.form || this.data.form;

    return Boolean(selectedDate && selectedTime && selectedServiceIds.length && form.name.trim() && form.phone.trim());
  },

  getValidationMessage() {
    const { selectedDate, selectedTime, selectedServiceIds, form } = this.data;

    if (!selectedDate) {
      return "请选择预约日期";
    }

    if (!selectedTime) {
      return "请选择可约时间";
    }

    if (this.data.selectedTimeBooked) {
      return "该时段已被占用";
    }

    if (!selectedServiceIds.length) {
      return "请选择美甲项目";
    }

    if (!form.name.trim()) {
      return "请填写姓名";
    }

    if (!form.phone.trim()) {
      return "请填写微信号或手机号";
    }

    return "";
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

  copyShareLink() {
    wx.setClipboardData({
      data: "指尖花园美甲预约：/pages/booking/booking",
      success: () => {
        wx.showToast({
          title: "已复制预约入口",
          icon: "success"
        });
      }
    });
  },

  showTimelineShareTip() {
    wx.showModal({
      title: "分享到朋友圈",
      content: "请点击右上角“...”菜单，选择“分享到朋友圈”。",
      showCancel: false,
      confirmColor: "#d75f7a"
    });
  },

  async submitBooking() {
    if (!this.data.canSubmit) {
      wx.showToast({
        title: this.getValidationMessage() || "请完善预约信息",
        icon: "none"
      });
      return;
    }

    wx.showLoading({
      title: "提交中"
    });

    try {
      const appointments = await app.getAppointments();
      const isTaken = appointments.some(
        (item) => item.date === this.data.selectedDate && item.time === this.data.selectedTime
      );

      if (isTaken) {
        wx.hideLoading();
        wx.showToast({
          title: "该时段刚被占用",
          icon: "none"
        });
        this.refreshSlots();
        return;
      }

      const summary = this.getServiceSummary(this.data.selectedServiceIds);
      const appointment = {
        id: `${Date.now()}`,
        date: this.data.selectedDate,
        time: this.data.selectedTime,
        serviceId: this.data.selectedServiceIds.join(","),
        serviceName: summary.names,
        priceLabel: summary.priceLabel,
        name: this.data.form.name.trim(),
        phone: this.data.form.phone.trim(),
        note: this.data.form.note.trim(),
        createdAt: new Date().toLocaleString("zh-CN"),
        isBlocked: false
      };

      await app.saveAppointment(appointment);
      wx.hideLoading();
      wx.showToast({
        title: "预约成功",
        icon: "success"
      });

      this.setData({
        selectedServiceIds: [],
        selectedServiceNames: "",
        selectedPriceLabel: "",
        selectedTime: "",
        selectedTimeBooked: false,
        serviceGroups: this.buildServiceGroups([]),
        form: {
          name: "",
          phone: "",
          note: ""
        },
        canSubmit: false
      });
      this.refreshSlots();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || "预约失败",
        icon: "none"
      });
    }
  }
});
