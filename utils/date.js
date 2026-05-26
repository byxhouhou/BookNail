const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function pad(value) {
  return `${value}`.padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDateOptions(days = 7) {
  const today = new Date();

  return Array.from({ length: days }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    return {
      value: formatDate(date),
      monthDay: `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`,
      week: index === 0 ? "今天" : weekdays[date.getDay()]
    };
  });
}

module.exports = {
  formatDate,
  getDateOptions
};
