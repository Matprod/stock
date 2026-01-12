export const getCircularProgressColor = (
  score?: number,
  type: "injury" | "performance" | "availability" = "injury",
) => {
  if (!score) return "stroke-gray-500";
  if (type === "performance") {
    if (score >= 70) return "stroke-emerald-400";
    if (score >= 40) return "stroke-yellow-300";
    return "stroke-red-500";
  }
  if (type === "availability") {
    if (score >= 70) return "stroke-emerald-400";
    if (score >= 40) return "stroke-yellow-300";
    return "stroke-red-500";
  }
  if (score >= 20) return "stroke-red-500";
  if (score < 10) return "stroke-emerald-400";
  return "stroke-yellow-300";
};
