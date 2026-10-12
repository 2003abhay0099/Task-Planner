const todoInput = document.getElementById("todo-input");
const todoDateInput = document.getElementById("todo-date");
const startTimeInput = document.getElementById("todo-start-time");
const endTimeInput = document.getElementById("todo-end-time");
const addBtn = document.getElementById("add-btn");
const sectionsContainer = document.getElementById("todo-sections-container");
const emptyState = document.getElementById("empty-state");
const filterBtns = document.querySelectorAll(".filter-btn");
const toggleAllBtn = document.getElementById("toggle-all-btn");

// Application State
let todos = JSON.parse(localStorage.getItem("todos")) || [];
let currentFilter = "all";
let collapsedDates = [];
let editingTodoId = null;

// Core LocalStorage Sync Functions
function saveToLocalStorage() {
  localStorage.setItem("todos", JSON.stringify(todos));
}

function setDefaultDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  todoDateInput.value = `${year}-${month}-${day}`;
}

function getFormattedDate(dateString) {
  if (!dateString) return "Unscheduled";
  const dateObj = new Date(dateString + "T00:00:00");
  return dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getHeaderColorClass(dateString) {
  if (!dateString) return "header-none";
  const dateObj = new Date(dateString + "T00:00:00");
  const day = dateObj.getDay();
  const dayClasses = [
    "header-sun",
    "header-mon",
    "header-tue",
    "header-wed",
    "header-thu",
    "header-fri",
    "header-sat"
  ];
  return dayClasses[day] || "header-none";
}

function formatTime12H(timeString) {
  if (!timeString) return "";
  const [hourStr, minStr] = timeString.split(":");
  let hours = parseInt(hourStr, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minStr} ${ampm}`;
}

// New Duration Calculator Helper
function calculateDurationText(start, end) {
  if (!start || !end) return "";

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  // Handle cross-midnight calculations gracefully (e.g., 11:00 PM to 1:00 AM)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const diff = endMinutes - startMinutes;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;

  let output = [];
  if (hours > 0) output.push(`${hours} ${hours === 1 ? "hr" : "hrs"}`);
  if (mins > 0) output.push(`${mins} ${mins === 1 ? "min" : "mins"}`);

  return output.length > 0 ? `(${output.join(" ")})` : "(0 mins)";
}

function getActiveUniqueDates() {
  const filteredTodos = todos.filter(todo => {
    if (currentFilter === "active") return !todo.completed;
    if (currentFilter === "completed") return todo.completed;
    return true;
  });
  return Array.from(
    new Set(filteredTodos.map(todo => todo.dateString || "Unscheduled"))
  );
}

function updateToggleAllButtonLabel() {
  const activeDates = getActiveUniqueDates();
  if (activeDates.length === 0) {
    toggleAllBtn.style.display = "none";
    return;
  }
  toggleAllBtn.style.display = "block";
  const allCollapsed = activeDates.every(date => collapsedDates.includes(date));
  toggleAllBtn.textContent = allCollapsed ? "Expand All" : "Collapse All";
}

function renderTodos() {
  sectionsContainer.innerHTML = "";

  const filteredTodos = todos.filter(todo => {
    if (currentFilter === "active") return !todo.completed;
    if (currentFilter === "completed") return todo.completed;
    return true;
  });

  if (filteredTodos.length === 0) {
    emptyState.textContent =
      currentFilter === "active"
        ? "No active tasks left!"
        : currentFilter === "completed"
        ? "No completed tasks yet."
        : "All caught up!";
    emptyState.style.display = "block";
    toggleAllBtn.style.display = "none";
    return;
  } else {
    emptyState.style.display = "none";
  }

  const groups = filteredTodos.reduce((acc, todo) => {
    const dateKey = todo.dateString || "Unscheduled";
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(todo);
    return acc;
  }, {});

  const sortedDateKeys = Object.keys(groups).sort((a, b) => {
    const itemA = groups[a][0];
    const itemB = groups[b][0];
    return (
      new Date(itemA.rawDate || "1970-01-01") -
      new Date(itemB.rawDate || "1970-01-01")
    );
  });

  sortedDateKeys.forEach(dateKey => {
    const isCollapsed = collapsedDates.includes(dateKey);
    const sampleTodo = groups[dateKey][0];
    const headerColorClass = getHeaderColorClass(sampleTodo.rawDate);

    groups[dateKey].sort((a, b) => {
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });

    const sectionDiv = document.createElement("div");
    sectionDiv.className = `date-section ${isCollapsed ? "collapsed" : ""}`;

    const header = document.createElement("div");
    header.className = `date-header ${headerColorClass}`;
    header.innerHTML = `
                    <span>${dateKey} (${groups[dateKey].length})</span>
                    <span class="arrow">&#9660;</span>
                `;

    header.addEventListener("click", () => {
      if (collapsedDates.includes(dateKey)) {
        collapsedDates = collapsedDates.filter(d => d !== dateKey);
      } else {
        collapsedDates.push(dateKey);
      }
      renderTodos();
    });

    const ul = document.createElement("ul");
    ul.className = "todo-list";

    groups[dateKey].forEach(todo => {
      const originalIndex = todos.findIndex(t => t.id === todo.id);
      const li = document.createElement("li");
      li.className = `todo-item ${todo.completed ? "completed" : ""}`;

      if (editingTodoId === todo.id) {
        li.style.background = "var(--edit-bg)";
        li.style.borderColor = "var(--input-focus)";

        const editForm = document.createElement("div");
        editForm.className = "edit-mode-container";

        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.className = "edit-input-text";
        textInput.value = todo.text;

        const metaRow = document.createElement("div");
        metaRow.className = "edit-meta-row";

        const dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.className = "edit-input-meta";
        dateInput.value = todo.rawDate;

        const startInput = document.createElement("input");
        startInput.type = "time";
        startInput.className = "edit-input-meta";
        startInput.value = todo.startTime || "";

        const endInput = document.createElement("input");
        endInput.type = "time";
        endInput.className = "edit-input-meta";
        endInput.value = todo.endTime || "";

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "edit-actions";

        const saveBtn = document.createElement("button");
        saveBtn.className = "edit-save-btn";
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", () =>
          commitEdit(
            originalIndex,
            textInput.value,
            dateInput.value,
            startInput.value,
            endInput.value
          )
        );

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "edit-cancel-btn";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => {
          editingTodoId = null;
          renderTodos();
        });

        textInput.addEventListener("keypress", e => {
          if (e.key === "Enter")
            commitEdit(
              originalIndex,
              textInput.value,
              dateInput.value,
              startInput.value,
              endInput.value
            );
        });

        actionsDiv.appendChild(cancelBtn);
        actionsDiv.appendChild(saveBtn);

        metaRow.appendChild(dateInput);
        metaRow.appendChild(startInput);
        metaRow.appendChild(endInput);
        metaRow.appendChild(actionsDiv);

        editForm.appendChild(textInput);
        editForm.appendChild(metaRow);
        li.appendChild(editForm);

        setTimeout(() => textInput.focus(), 10);
      } else {
        const contentDiv = document.createElement("div");
        contentDiv.className = "todo-content";
        contentDiv.addEventListener("click", () => toggleTodo(originalIndex));

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = todo.completed;

        const detailsWrapper = document.createElement("div");
        detailsWrapper.className = "todo-details-wrapper";

        const textSpan = document.createElement("span");
        textSpan.className = "todo-text";
        textSpan.textContent = todo.text;
        detailsWrapper.appendChild(textSpan);

        if (todo.startTime || todo.endTime) {
          const durationBadge = document.createElement("span");
          durationBadge.className = "time-badge";

          let displayLabel = "";
          if (todo.startTime && todo.endTime) {
            // Dynamic duration string calculation added inside render loop
            const durationText = calculateDurationText(
              todo.startTime,
              todo.endTime
            );
            displayLabel = `${formatTime12H(todo.startTime)} - ${formatTime12H(
              todo.endTime
            )} ${durationText}`;
          } else if (todo.startTime) {
            displayLabel = `Starts ${formatTime12H(todo.startTime)}`;
          } else {
            displayLabel = `By ${formatTime12H(todo.endTime)}`;
          }

          durationBadge.innerHTML = `⏰ ${displayLabel}`;
          detailsWrapper.appendChild(durationBadge);
        }

        contentDiv.appendChild(checkbox);
        contentDiv.appendChild(detailsWrapper);

        const actionsWrapper = document.createElement("div");
        actionsWrapper.className = "actions-wrapper";

        const editBtn = document.createElement("button");
        editBtn.className = "action-icon-btn edit-btn";
        editBtn.innerHTML = "✏️";
        editBtn.title = "Edit Task";
        editBtn.addEventListener("click", e => {
          e.stopPropagation();
          editingTodoId = todo.id;
          renderTodos();
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "action-icon-btn delete-btn";
        deleteBtn.innerHTML = "&times;";
        deleteBtn.title = "Delete Task";
        deleteBtn.addEventListener("click", e => {
          e.stopPropagation();
          deleteTodo(originalIndex);
        });

        actionsWrapper.appendChild(editBtn);
        actionsWrapper.appendChild(deleteBtn);

        li.appendChild(contentDiv);
        li.appendChild(actionsWrapper);
      }

      ul.appendChild(li);
    });

    sectionDiv.appendChild(header);
    sectionDiv.appendChild(ul);
    sectionsContainer.appendChild(sectionDiv);
  });

  updateToggleAllButtonLabel();
}

function addTodo() {
  const taskText = todoInput.value.trim();
  const chosenDate = todoDateInput.value;
  const startVal = startTimeInput.value || null;
  const endVal = endTimeInput.value || null;

  if (!taskText) return;

  todos.push({
    id: Date.now(),
    text: taskText,
    completed: false,
    rawDate: chosenDate,
    dateString: getFormattedDate(chosenDate),
    startTime: startVal,
    endTime: endVal
  });

  todoInput.value = "";
  startTimeInput.value = "";
  endTimeInput.value = "";
  setDefaultDate();
  todoInput.focus();

  saveToLocalStorage();
  renderTodos();
}

function commitEdit(index, newText, newRawDate, newStart, newEnd) {
  const sanitizedText = newText.trim();
  if (!sanitizedText) return;

  todos[index].text = sanitizedText;
  todos[index].rawDate = newRawDate;
  todos[index].dateString = getFormattedDate(newRawDate);
  todos[index].startTime = newStart || null;
  todos[index].endTime = newEnd || null;

  editingTodoId = null;
  saveToLocalStorage();
  renderTodos();
}

function toggleTodo(index) {
  todos[index].completed = !todos[index].completed;
  saveToLocalStorage();
  renderTodos();
}

function deleteTodo(index) {
  if (todos[index] && todos[index].id === editingTodoId) {
    editingTodoId = null;
  }
  todos.splice(index, 1);
  saveToLocalStorage();
  renderTodos();
}

toggleAllBtn.addEventListener("click", () => {
  const activeDates = getActiveUniqueDates();
  const allCollapsed = activeDates.every(date => collapsedDates.includes(date));
  collapsedDates = allCollapsed ? [] : [...activeDates];
  renderTodos();
});

addBtn.addEventListener("click", addTodo);
todoInput.addEventListener("keypress", e => {
  if (e.key === "Enter") addTodo();
});

filterBtns.forEach(btn => {
  btn.addEventListener("click", e => {
    document.querySelector(".filter-btn.active").classList.remove("active");
    e.target.classList.add("active");
    currentFilter = e.target.getAttribute("data-filter");
    renderTodos();
  });
});

// --- QUICK CHECKLIST DRAWERS ENGINE ---
const scratchToggle = document.getElementById("scratch-toggle");
const scratchDrawer = document.getElementById("scratch-drawer");
const scratchClose = document.getElementById("scratch-close");
const scratchInput = document.getElementById("scratch-item-input");
const scratchAddBtn = document.getElementById("scratch-add-btn");
const scratchListContainer = document.getElementById("scratch-list-container");

let scratchItems = JSON.parse(localStorage.getItem("scratchpad_items")) || [];

scratchToggle.addEventListener("click", () =>
  scratchDrawer.classList.add("open")
);
scratchClose.addEventListener("click", () =>
  scratchDrawer.classList.remove("open")
);

function saveScratchData() {
  localStorage.setItem("scratchpad_items", JSON.stringify(scratchItems));
}

function renderScratchItems() {
  scratchListContainer.innerHTML = "";

  scratchItems.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = `scratch-item ${item.done ? "done" : ""}`;

    li.innerHTML = `
                    <input type="checkbox" ${item.done ? "checked" : ""}>
                    <span>${item.text}</span>
                    <button class="scratch-delete">&times;</button>
                `;

    li.querySelector("input").addEventListener("change", () => {
      scratchItems[idx].done = !scratchItems[idx].done;
      saveScratchData();
      renderScratchItems();
    });

    li.querySelector("span").addEventListener("click", () => {
      scratchItems[idx].done = !scratchItems[idx].done;
      saveScratchData();
      renderScratchItems();
    });

    li.querySelector(".scratch-delete").addEventListener("click", () => {
      scratchItems.splice(idx, 1);
      saveScratchData();
      renderScratchItems();
    });

    scratchListContainer.appendChild(li);
  });
}

function addScratchItem() {
  const text = scratchInput.value.trim();
  if (!text) return;

  scratchItems.push({ text, done: false });
  scratchInput.value = "";
  saveScratchData();
  renderScratchItems();
  scratchInput.focus();
}

scratchAddBtn.addEventListener("click", addScratchItem);
scratchInput.addEventListener("keypress", e => {
  if (e.key === "Enter") addScratchItem();
});

// App Initializations
setDefaultDate();
renderTodos();
renderScratchItems();
