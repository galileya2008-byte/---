(function () {
  "use strict";

  var core = window.PracticeCore;
  var KEY = "onoprienko-liniya-dnya-v1";
  var PAPER = "#fbfaf7";
  var MONTHS = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];
  var MONTHS_GEN = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  var canvas = document.getElementById("draw-canvas");
  var frame = document.getElementById("canvas-frame");
  var ctx = canvas ? canvas.getContext("2d") : null;
  var todayTask = document.getElementById("today-task");
  var allTasks = document.getElementById("all-tasks");
  var canvasError = document.getElementById("canvas-error");
  var storageWarning = document.getElementById("storage-warning");
  var statusLine = document.getElementById("live-status");
  var counter = document.getElementById("day-counter");
  var todayFlag = document.getElementById("today-flag");
  var oldDrawing = document.getElementById("old-drawing");
  var completeBtn = document.getElementById("complete");
  var undoBtn = document.getElementById("undo");
  var clearBtn = document.getElementById("clear");
  var saveBtn = document.getElementById("save-png");
  var resetBtn = document.getElementById("reset-progress");
  var widthInput = document.getElementById("line-width");
  var widthValue = document.getElementById("line-width-value");
  var colorName = document.getElementById("color-name");
  var calBody = document.getElementById("cal-body");
  var calCaption = document.getElementById("cal-caption");
  var calPrev = document.getElementById("cal-prev");
  var calNext = document.getElementById("cal-next");
  var dialog = document.getElementById("confirm-dialog");
  var dialogTitle = document.getElementById("confirm-title");
  var dialogText = document.getElementById("confirm-text");
  var dialogAccept = document.getElementById("confirm-accept");
  var dialogCancel = document.getElementById("confirm-cancel");

  var storageMode = "local";
  var state = { completed: [], strokes: [], drawingDate: "" };
  var color = "#172033";
  var lineWidth = 4;
  var cssW = 0;
  var cssH = 0;
  var currentDpr = 1;
  var activeStroke = null;
  var activePointer = null;
  var pendingConfirm = null;
  var confirmOpener = null;
  var viewYear = 0;
  var viewMonth = 0;

  function announce(text) {
    if (!statusLine) return;
    statusLine.textContent = "";
    window.setTimeout(function () {
      statusLine.textContent = text;
    }, 30);
  }

  function showStorageWarning() {
    if (!storageWarning) return;
    storageWarning.hidden = false;
    announce(storageWarning.textContent.trim());
  }

  function today() {
    return new Date();
  }

  function emptyState() {
    return { completed: [], strokes: [], drawingDate: "" };
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function sanitize(parsed) {
    var clean = emptyState();
    if (!parsed || typeof parsed !== "object") return { state: clean, corrupt: true };
    var seen = Object.create(null);
    if (Array.isArray(parsed.completed)) {
      parsed.completed.forEach(function (item) {
        if (typeof item !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item)) return;
        var parts = item.split("-");
        var check = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (core.localDateKey(check) !== item) return;
        if (!seen[item]) {
          seen[item] = true;
          clean.completed.push(item);
        }
      });
    }
    if (Array.isArray(parsed.strokes)) {
      parsed.strokes.slice(0, 300).forEach(function (stroke) {
        if (!stroke || typeof stroke.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(stroke.color)) return;
        if (!Array.isArray(stroke.points) || !stroke.points.length) return;
        var points = [];
        stroke.points.slice(0, 4000).forEach(function (point) {
          if (!Array.isArray(point) || point.length < 2) return;
          var x = Number(point[0]);
          var y = Number(point[1]);
          if (!isFinite(x) || !isFinite(y)) return;
          points.push([clamp(x, -0.5, 1.5), clamp(y, -0.5, 1.5)]);
        });
        if (!points.length) return;
        clean.strokes.push({
          color: stroke.color.toLowerCase(),
          width: clamp(Number(stroke.width) || 4, 1, 32),
          points: points
        });
      });
    }
    if (typeof parsed.drawingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.drawingDate)) {
      clean.drawingDate = parsed.drawingDate;
    }
    return { state: clean, corrupt: false };
  }

  function readStore() {
    var raw;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch (error) {
      storageMode = "memory";
      return { state: emptyState(), unavailable: true, corrupt: false };
    }
    if (!raw) return { state: emptyState(), unavailable: false, corrupt: false };
    try {
      return Object.assign({ unavailable: false }, sanitize(JSON.parse(raw)));
    } catch (error) {
      return { state: emptyState(), unavailable: false, corrupt: true };
    }
  }

  function payload() {
    return {
      v: 1,
      completed: state.completed,
      strokes: state.strokes,
      drawingDate: state.drawingDate
    };
  }

  function persist() {
    if (storageMode !== "local") return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(payload()));
    } catch (error) {
      storageMode = "memory";
      showStorageWarning();
    }
  }

  function formatLong(date) {
    return date.getDate() + " " + MONTHS_GEN[date.getMonth()] + " " + date.getFullYear();
  }

  function renderToday() {
    if (!core || !todayTask) return;
    var date = today();
    var index = core.taskIndexForDate(date);
    var items = document.querySelectorAll("#task-list li");
    var source = items[index];
    todayTask.replaceChildren();
    var kicker = document.createElement("p");
    kicker.className = "task-kicker";
    kicker.textContent = formatLong(date) + " · задание " + (index + 1) + " из " + core.TASKS.length;
    var text = document.createElement("p");
    text.className = "task-text";
    text.textContent = source ? source.textContent.trim() : core.TASKS[index];
    todayTask.append(kicker, text);
    todayTask.hidden = false;
    if (allTasks) allTasks.hidden = true;
  }

  function renderProgress() {
    var dateKey = core.localDateKey(today());
    var count = state.completed.length;
    if (counter) {
      counter.textContent = "Выполнено: " + count + " " + core.daysWord(count);
    }
    if (todayFlag) todayFlag.hidden = state.completed.indexOf(dateKey) === -1;
    if (completeBtn) completeBtn.setAttribute("aria-pressed", todayFlag && !todayFlag.hidden ? "true" : "false");
    if (oldDrawing) {
      var showOld = state.strokes.length > 0 && state.drawingDate && state.drawingDate !== dateKey;
      oldDrawing.hidden = !showOld;
    }
  }

  function renderCalendar() {
    if (!calBody || !calCaption) return;
    var now = today();
    var currentKey = core.localDateKey(now);
    var isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
    calCaption.textContent = MONTHS[viewMonth] + " " + viewYear;
    if (calNext) calNext.disabled = isCurrentMonth;
    calBody.replaceChildren();
    var first = new Date(viewYear, viewMonth, 1);
    var offset = (first.getDay() + 6) % 7;
    var days = new Date(viewYear, viewMonth + 1, 0).getDate();
    var row = document.createElement("tr");
    var cellIndex = 0;
    function pushCell(cell) {
      row.append(cell);
      cellIndex += 1;
      if (cellIndex % 7 === 0) {
        calBody.append(row);
        row = document.createElement("tr");
      }
    }
    var i;
    for (i = 0; i < offset; i += 1) {
      var blank = document.createElement("td");
      blank.setAttribute("aria-hidden", "true");
      pushCell(blank);
    }
    for (i = 1; i <= days; i += 1) {
      var key = core.localDateKey(new Date(viewYear, viewMonth, i));
      var cell = document.createElement("td");
      cell.textContent = String(i);
      var label = i + " " + MONTHS_GEN[viewMonth] + " " + viewYear;
      if (state.completed.indexOf(key) !== -1) {
        cell.classList.add("is-done");
        label += ", задание выполнено";
      }
      if (key === currentKey) {
        cell.classList.add("is-today");
        cell.setAttribute("aria-current", "date");
        label += ", сегодня";
      }
      cell.setAttribute("aria-label", label);
      pushCell(cell);
    }
    while (cellIndex % 7 !== 0) {
      var tail = document.createElement("td");
      tail.setAttribute("aria-hidden", "true");
      pushCell(tail);
    }
  }

  function updateTools() {
    var hasInk = state.strokes.length > 0 || !!activeStroke;
    if (undoBtn) undoBtn.disabled = state.strokes.length === 0;
    if (clearBtn) clearBtn.disabled = !hasInk;
  }

  function redraw() {
    if (!ctx || !cssW || !cssH) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
    var strokes = state.strokes.slice();
    if (activeStroke) strokes.push(activeStroke);
    strokes.forEach(function (stroke) {
      drawStroke(stroke);
    });
  }

  function drawStroke(stroke) {
    if (!stroke.points.length) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    var first = stroke.points[0];
    if (stroke.points.length === 1) {
      ctx.beginPath();
      ctx.arc(first[0] * cssW, first[1] * cssH, Math.max(stroke.width / 2, 0.8), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(first[0] * cssW, first[1] * cssH);
    for (var i = 1; i < stroke.points.length; i += 1) {
      ctx.lineTo(stroke.points[i][0] * cssW, stroke.points[i][1] * cssH);
    }
    ctx.stroke();
  }

  function resizeCanvas() {
    if (!canvas || !frame || !ctx) return;
    var rect = frame.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(rect.width);
    var h = Math.round(rect.height);
    if (w < 2 || h < 2) return;
    if (w === cssW && h === cssH && dpr === currentDpr) return;
    cssW = w;
    cssH = h;
    currentDpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    redraw();
  }

  function pointFromEvent(event) {
    var rect = canvas.getBoundingClientRect();
    var width = rect.width || 1;
    var height = rect.height || 1;
    return [
      clamp((event.clientX - rect.left) / width, -0.05, 1.05),
      clamp((event.clientY - rect.top) / height, -0.05, 1.05)
    ];
  }

  function rememberPoint(point) {
    var points = activeStroke.points;
    var last = points[points.length - 1];
    if (last) {
      var dx = point[0] - last[0];
      var dy = point[1] - last[1];
      if (dx * dx + dy * dy < 0.000004) return;
    }
    if (points.length >= 4000) return;
    points.push(point);
    redraw();
  }

  function finishStroke(event) {
    if (!activeStroke || event.pointerId !== activePointer) return;
    activePointer = null;
    if (activeStroke.points.length) {
      state.strokes.push(activeStroke);
      if (!state.drawingDate) state.drawingDate = core.localDateKey(today());
      if (state.strokes.length > 300) state.strokes.shift();
      persist();
    }
    activeStroke = null;
    updateTools();
    renderProgress();
  }

  function onPointerDown(event) {
    if (!ctx || activePointer !== null) return;
    if (event.isPrimary === false) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    activePointer = event.pointerId;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      /* Synthetic and some touch events cannot be captured. */
    }
    activeStroke = { color: color, width: lineWidth, points: [] };
    if (!state.drawingDate) state.drawingDate = core.localDateKey(today());
    rememberPoint(pointFromEvent(event));
    updateTools();
  }

  function onPointerMove(event) {
    if (!activeStroke || event.pointerId !== activePointer) return;
    event.preventDefault();
    var events = [event];
    if (typeof event.getCoalescedEvents === "function") {
      try {
        var coalesced = event.getCoalescedEvents();
        if (coalesced && coalesced.length) events = coalesced;
      } catch (error) {
        events = [event];
      }
    }
    events.forEach(function (item) {
      rememberPoint(pointFromEvent(item));
    });
  }

  function undo() {
    if (!state.strokes.length) return;
    state.strokes.pop();
    if (!state.strokes.length) state.drawingDate = "";
    persist();
    redraw();
    updateTools();
    renderProgress();
    announce("Последний штрих отменён.");
  }

  function clearDrawing() {
    state.strokes = [];
    state.drawingDate = "";
    activeStroke = null;
    persist();
    redraw();
    updateTools();
    renderProgress();
    announce("Рисунок очищен. Отметки в календаре сохранены.");
  }

  function markToday() {
    var key = core.localDateKey(today());
    if (state.completed.indexOf(key) === -1) {
      state.completed.push(key);
      persist();
      announce("Практика за " + formatLong(today()) + " отмечена.");
    } else {
      announce("Сегодняшнее задание уже отмечено. Повторно оно не считается.");
    }
    renderProgress();
    renderCalendar();
  }

  function resetProgress() {
    state = emptyState();
    activeStroke = null;
    try {
      window.localStorage.removeItem(KEY);
      storageMode = "local";
    } catch (error) {
      storageMode = "memory";
      showStorageWarning();
    }
    redraw();
    updateTools();
    renderProgress();
    renderCalendar();
    announce("Прогресс и рисунок в этом браузере сброшены.");
  }

  function savePng() {
    if (!canvas) return;
    try {
      var url = canvas.toDataURL("image/png");
      var link = document.createElement("a");
      link.href = url;
      link.download = "liniya-dnya-" + core.localDateKey(today()) + ".png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      announce("Рисунок подготовлен как PNG.");
    } catch (error) {
      announce("Не удалось подготовить PNG в этом браузере.");
    }
  }

  function askConfirm(options) {
    confirmOpener = document.activeElement;
    if (!dialog || typeof dialog.showModal !== "function") {
      if (window.confirm(options.title + "\n\n" + options.text)) options.onAccept();
      return;
    }
    pendingConfirm = options;
    dialogTitle.textContent = options.title;
    dialogText.textContent = options.text;
    dialogAccept.textContent = options.acceptLabel;
    dialog.showModal();
    dialogCancel.focus();
  }

  function closeDialog() {
    pendingConfirm = null;
    if (dialog && dialog.open) dialog.close();
    if (confirmOpener && typeof confirmOpener.focus === "function") confirmOpener.focus();
  }

  function bindColor(button) {
    button.addEventListener("click", function () {
      color = button.getAttribute("data-color") || color;
      document.querySelectorAll(".swatch").forEach(function (item) {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
      if (colorName) colorName.textContent = "Цвет: " + (button.getAttribute("data-label") || "");
    });
  }

  function initFromStorage() {
    var loaded = readStore();
    state = loaded.state;
    if (loaded.unavailable) showStorageWarning();
    if (loaded.corrupt) {
      announce("Не удалось прочитать прежние сохранения. Начат новый прогресс в этом браузере.");
      persist();
    }
  }

  function init() {
    if (!core) throw new Error("PracticeCore missing");
    var now = today();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    renderToday();
    initFromStorage();
    if (widthInput) {
      lineWidth = clamp(Number(widthInput.value) || 4, 2, 16);
      widthInput.addEventListener("input", function () {
        lineWidth = clamp(Number(widthInput.value) || 4, 2, 16);
        if (widthValue) widthValue.textContent = String(lineWidth);
      });
    }
    document.querySelectorAll(".swatch").forEach(bindColor);
    if (ctx) {
      resizeCanvas();
      if (typeof ResizeObserver === "function") {
        var observer = new ResizeObserver(function () {
          resizeCanvas();
        });
        observer.observe(frame);
      } else {
        window.addEventListener("resize", resizeCanvas);
      }
      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", finishStroke);
      window.addEventListener("pointercancel", finishStroke);
      window.addEventListener("resize", resizeCanvas);
      canvas.addEventListener("contextmenu", function (event) {
        event.preventDefault();
      });
    } else if (canvasError) {
      canvasError.hidden = false;
    }
    if (undoBtn) undoBtn.addEventListener("click", undo);
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        askConfirm({
          title: "Очистить рисунок?",
          text: "Текущий рисунок будет удалён из этого браузера. Отметки в календаре сохранятся.",
          acceptLabel: "Очистить",
          onAccept: clearDrawing
        });
      });
    }
    if (saveBtn) {
      saveBtn.disabled = !ctx;
      saveBtn.addEventListener("click", savePng);
    }
    if (completeBtn) {
      completeBtn.disabled = false;
      completeBtn.addEventListener("click", markToday);
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        askConfirm({
          title: "Сбросить прогресс?",
          text: "Будут удалены отметки дней и текущий рисунок в этом браузере. Это действие нельзя отменить.",
          acceptLabel: "Сбросить",
          onAccept: resetProgress
        });
      });
    }
    if (calPrev) {
      calPrev.disabled = false;
      calPrev.addEventListener("click", function () {
        viewMonth -= 1;
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear -= 1;
        }
        renderCalendar();
      });
    }
    if (calNext) {
      calNext.addEventListener("click", function () {
        var nowDate = today();
        var nextMonth = viewMonth + 1;
        var nextYear = viewYear;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear += 1;
        }
        if (nextYear > nowDate.getFullYear() || (nextYear === nowDate.getFullYear() && nextMonth > nowDate.getMonth())) return;
        viewMonth = nextMonth;
        viewYear = nextYear;
        renderCalendar();
      });
    }
    if (dialogAccept) {
      dialogAccept.addEventListener("click", function () {
        var action = pendingConfirm && pendingConfirm.onAccept;
        pendingConfirm = null;
        if (dialog.open) dialog.close();
        if (action) action();
        if (confirmOpener && typeof confirmOpener.focus === "function") confirmOpener.focus();
      });
    }
    if (dialogCancel) dialogCancel.addEventListener("click", closeDialog);
    if (dialog) {
      dialog.addEventListener("close", function () {
        pendingConfirm = null;
        if (confirmOpener && typeof confirmOpener.focus === "function") confirmOpener.focus();
      });
    }
    document.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        if (dialog && dialog.open) return;
        var tag = event.target && event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        event.preventDefault();
        undo();
      }
    });
    updateTools();
    renderProgress();
    renderCalendar();
  }

  try {
    init();
  } catch (error) {
    if (canvasError) {
      canvasError.hidden = false;
      canvasError.textContent = "Интерактив не удалось запустить в этом браузере. Задания выше можно выполнить на бумаге.";
    }
  }
})();
