Chart.defaults.global.defaultFontFamily = "Poppins";
let ctx = document.querySelector("#revenueChart");
ctx.height = 53;

let revChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [
      "Sept 1",
      "Sept 3",
      "Sept 6",
      "Sept 9",
      "Sept 12",
      "Sept 15",
      "Sept 18",
      "Sept 21",
      "Sept 24",
      "Sept 27",
      "Sept 30"
    ],
    datasets: [
      {
        label: "Views",
        borderColor: "green",
        backgroundColor: "rgba(235, 247, 245, 0.5)",
        data: [0, 30, 60, 25, 60, 25, 50, 10, 50, 90, 120]
      },
      {
        label: "Watch time",
        borderColor: "blue",
        backgroundColor: "rgba(233, 238, 253, 0.5)",
        data: [0, 60, 25, 100, 20, 75, 30, 55, 20, 60, 20]
      }
    ]
  },
  options: {
    responsive: true,
    tooltips: {
      intersect: false,
      node: "index"
    }
  }
});