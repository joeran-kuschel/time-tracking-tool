// Hours of an entry as a string with two decimals; a running entry has no end yet and counts as 0
function calculateHours(startTime, endTime) {
  if (!endTime) return 0;
  const diff = new Date(endTime) - new Date(startTime);
  return (diff / (1000 * 60 * 60)).toFixed(2);
}

module.exports = { calculateHours };
