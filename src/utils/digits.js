window.addEventListener(
  "load",
  function () {
    var ws,
      b,
      rnd,
      spot,
      time,
      dps,
      xd,
      digit,
      cnt,
      random,
      id,
      lng,
      str,
      chart,
      xVal,
      yVal,
      mType,
      mColor,
      rndMenu;

    str = ["R_100", "R_10", "R_25", "R_50", "R_75", "RDBEAR", "RDBULL"];
    dps = [];
    time = [0];
    spot = [0];
    digit = [0];
    mType = "none";
    mColor = "#32cd32";
    lng = "EN";
    xVal = 0;
    yVal = 0;
    cnt = 20;

    rndMenu = document.querySelectorAll("div.menu > span");

    for (var i = 0; i < rndMenu.length; i++) {
      clickMenu(rndMenu[i]);
    }

    function toggleMenu(data) {
      for (var i = 0; i < rndMenu.length; i++) {
        rndMenu[i].classList.remove("menu-active");
      }
      data.classList.add("menu-active");
    }

    function clickMenu(data) {
      data.addEventListener("click", function () {
        toggleMenu(data);
      });
    }

    function toggleDigit(d, m) {
      var nameClass = document.querySelector(
        "#digits > span:nth-child(" + d + ")"
      ).className;
      if (nameClass != "digits_moved_" + m) {
        document
          .querySelector("#digits > span:nth-child(" + d + ")")
          .classList.remove(nameClass);
        document
          .querySelector("#digits > span:nth-child(" + d + ")")
          .classList.add("digits_moved_" + m);
      }
    }

    function rndGet() {
      random = document.querySelector(
        "body > div.menu > span.menu-active"
      ).title;
      switch (random) {
        case str[0]:
          rnd = "R_100";
          xd = 2;
          break;
        case str[1]:
          rnd = "R_10";
          xd = 3;
          break;
        case str[2]:
          rnd = "R_25";
          xd = 3;
          break;
        case str[3]:
          rnd = "R_50";
          xd = 4;
          break;
        case str[4]:
          rnd = "R_75";
          xd = 4;
          break;
        case str[5]:
          rnd = "RDBEAR";
          xd = 4;
          break;
        case str[6]:
          rnd = "RDBULL";
          xd = 4;
          break;
        default:
          rnd = "R";
          xd = 0;
          break;
      }
    }

    rndGet();

    ws = new WebSocket(
      "wss://ws.binaryws.com/websockets/v3?app_id=3738&l=" + lng
    );

    ws.onopen = function (evt) {
      ws.send(JSON.stringify({ ticks: rnd }));
    };

    ws.onmessage = function (msg) {
      b = JSON.parse(msg.data);

      if (b.tick) {
        document.querySelector("#loader").classList.remove("loader");

        rndGet();

        if (b.echo_req.ticks == rnd) {
          id = b.tick.id;
          ws.send(
            JSON.stringify({
              ticks_history: rnd,
              end: "latest",
              start: 1,
              style: "ticks",
              count: cnt + 1,
            })
          );
        } else {
          ws.send(JSON.stringify({ forget: id }));
          ws.send(JSON.stringify({ forget_all: "ticks" }));
          ws.send(JSON.stringify({ ticks: rnd }));
        }
      }

      if (b.history) {
        if (b.echo_req.ticks_history == rnd) {
          for (var i = 0; i < cnt + 1; i++) {
            time[i] = b.history.times[cnt - i];
            spot[i] = b.history.prices[cnt - i];
            spot[i] = Number(spot[i]).toFixed(xd);
            digit[i] = spot[i].slice(-1);
          }

          for (var i = 0; i < cnt + 1; i++) {
            xVal = new Date(time[i] * 1000);
            yVal = parseFloat(spot[i]);

            if (i == 0) mType = "circle";
            else mType = "none";

            if (yVal == Math.max.apply(null, spot)) {
              mColor = "#29abe2";
              mType = "circle";
            } else if (yVal == Math.min.apply(null, spot)) {
              mColor = "#c03";
              mType = "circle";
            } else {
              mColor = "#32cd32";
            }

            dps.push({
              x: xVal,
              y: yVal,
              markerType: mType,
              markerColor: mColor,
              markerBorderColor: "#ccc",
            });
          }

          if (dps.length > cnt + 1) {
            while (dps.length != cnt + 1) {
              dps.shift();
            }
          }

          chart.render();

          spot.reverse();
          digit.reverse();

          for (var i = 1; i < cnt + 1; i++) {
            document.querySelector(
              "#digits > span:nth-child(" + i + ")"
            ).innerHTML = digit[i];

            if (spot[i - 1] < spot[i]) {
              toggleDigit(i, "up");
            } else if (spot[i - 1] > spot[i]) {
              toggleDigit(i, "down");
            } else if (spot[i - 1] == spot[i] && i - 1 > 0) {
              if (
                document.querySelector(
                  "#digits > span:nth-child(" + (i - 1) + ")"
                ).className == "digits_moved_up"
              ) {
                toggleDigit(i, "up");
              } else if (
                document.querySelector(
                  "#digits > span:nth-child(" + (i - 1) + ")"
                ).className == "digits_moved_down"
              ) {
                toggleDigit(i, "down");
              }
            }
          }
        }
      }
    };

    chart = new CanvasJS.Chart("chartContainer", {
      animationEnabled: true,
      theme: "light2",
      title: {
        titleFontSize: 0,
        text: "",
      },
      toolTip: {
        enabled: true,
        animationEnabled: true,
        borderColor: "#ccc",
        borderThickness: 1,
        fontColor: "#000",
        content: "{y}",
      },
      axisX: {
        includeZero: false,
        titleFontSize: 0,
        labelFontSize: 0,
        gridThickness: 0,
        tickLength: 0,
        lineThickness: 1,
      },
      axisY: {
        includeZero: false,
        titleFontSize: 0,
        labelFontSize: 0,
        gridThickness: 0,
        tickLength: 0,
        lineThickness: 1,
      },
      data: [
        {
          type: "spline",
          lineColor: "#ccc",
          lineThickness: 2,
          markerType: "none",
          markerSize: 5,
          markerBorderThickness: 0,
          dataPoints: dps,
        },
      ],
    });
  },
  false
);
