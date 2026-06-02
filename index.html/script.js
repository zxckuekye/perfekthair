const bookingKey = "perfekt-hair-bookings";
const defaultBusy = ["10:00", "15:00"];
const services = [
  "Кератин",
  "Ботокс волос",
  "Нанопластика",
  "Холодное восстановление",
  "Уходовые процедуры",
  "Полировка волос",
];
const slots = ["09:00", "10:00", "11:30", "13:00", "15:00", "16:30", "18:00", "19:30"];

document.querySelector(".nav-toggle")?.addEventListener("click", () => {
  document.querySelector(".main-nav")?.classList.toggle("open");
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  },
  { threshold: 0.12 },
);
document.querySelectorAll(".reveal").forEach((item) => revealObserver.observe(item));

function getLocalBookings() {
  return JSON.parse(localStorage.getItem(bookingKey) || "{}");
}

function saveLocalBookings(bookings) {
  localStorage.setItem(bookingKey, JSON.stringify(bookings));
}

function canUseServerApi() {
  return location.protocol === "http:" || location.protocol === "https:";
}

async function loadBookings() {
  if (!canUseServerApi()) return getLocalBookings();

  try {
    const response = await fetch("/api/bookings", { cache: "no-store" });
    if (!response.ok) throw new Error("Booking API is unavailable");
    const data = await response.json();
    return data.busy || {};
  } catch {
    return getLocalBookings();
  }
}

async function createBooking(payload) {
  if (canUseServerApi()) {
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        return { ok: false, message: data.message || "Не удалось сохранить запись." };
      }

      return { ok: true, busy: data.busy || {} };
    } catch {
      // Fall through to local storage so the form still works during local previews.
    }
  }

  const bookings = getLocalBookings();
  bookings[payload.date] = [...new Set([...(bookings[payload.date] || []), payload.time])];
  saveLocalBookings(bookings);
  return { ok: true, busy: bookings };
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonth(date) {
  return date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function createBookingWidget(root) {
  let viewDate = new Date();
  viewDate.setDate(1);
  let selectedDate = new Date();
  let selectedSlot = "";
  let bookings = {};

  root.innerHTML = `
    <div class="booking-top">
      <button class="icon-btn" type="button" data-prev-month aria-label="Предыдущий месяц">‹</button>
      <h3 data-month></h3>
      <button class="icon-btn" type="button" data-next-month aria-label="Следующий месяц">›</button>
    </div>
    <div class="calendar-grid" data-calendar></div>
    <div class="slots" data-slots></div>
    <form class="booking-form" data-booking-form>
      <input name="name" required placeholder="Ваше имя" autocomplete="name" />
      <input name="phone" required placeholder="Телефон" autocomplete="tel" />
      <select name="service" required>
        <option value="">Выберите услугу</option>
        ${services.map((service) => `<option>${service}</option>`).join("")}
      </select>
      <button class="btn btn-primary" type="submit">Подтвердить запись</button>
      <p class="form-message" data-form-message></p>
    </form>
  `;

  const monthEl = root.querySelector("[data-month]");
  const calendarEl = root.querySelector("[data-calendar]");
  const slotsEl = root.querySelector("[data-slots]");
  const form = root.querySelector("[data-booking-form]");
  const message = root.querySelector("[data-form-message]");

  function setFormDisabled(disabled) {
    form.querySelectorAll("button, input, select").forEach((control) => {
      control.disabled = disabled;
    });
  }

  async function refreshBookings() {
    bookings = await loadBookings();
    renderSlots();
  }

  function renderCalendar() {
    monthEl.textContent = formatMonth(viewDate);
    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const firstDayIndex = (viewDate.getDay() + 6) % 7;
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const todayKey = formatDateKey(new Date());
    const selectedKey = formatDateKey(selectedDate);

    calendarEl.innerHTML = days.map((day) => `<div class="weekday">${day}</div>`).join("");

    for (let i = 0; i < firstDayIndex; i += 1) {
      calendarEl.insertAdjacentHTML("beforeend", "<div></div>");
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      const key = formatDateKey(date);
      const disabled = key < todayKey ? "disabled" : "";
      const active = key === selectedKey ? "active" : "";
      calendarEl.insertAdjacentHTML(
        "beforeend",
        `<button class="day-btn ${active}" type="button" data-date="${key}" ${disabled}>${day}</button>`,
      );
    }
    renderSlots();
  }

  function renderSlots() {
    const key = formatDateKey(selectedDate);
    const busySlots = new Set([...(bookings[key] || []), ...defaultBusy]);
    slotsEl.innerHTML = slots
      .map((slot) => {
        const busy = busySlots.has(slot);
        const active = selectedSlot === slot && !busy ? "active" : "";
        return `<button class="slot-btn ${busy ? "busy" : active}" type="button" data-slot="${slot}" ${busy ? "disabled" : ""}>${slot}</button>`;
      })
      .join("");
  }

  root.querySelector("[data-prev-month]").addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
  });

  root.querySelector("[data-next-month]").addEventListener("click", () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
  });

  calendarEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    selectedDate = new Date(`${button.dataset.date}T12:00:00`);
    selectedSlot = "";
    message.textContent = "";
    renderCalendar();
    refreshBookings();
  });

  slotsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-slot]");
    if (!button || button.disabled) return;
    selectedSlot = button.dataset.slot;
    message.textContent = "";
    renderSlots();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedSlot) {
      message.textContent = "Выберите свободное время.";
      return;
    }
    const data = new FormData(form);
    const key = formatDateKey(selectedDate);

    setFormDisabled(true);
    message.textContent = "Сохраняем запись...";

    const result = await createBooking({
      date: key,
      time: selectedSlot,
      name: data.get("name"),
      phone: data.get("phone"),
      service: data.get("service"),
    });

    setFormDisabled(false);

    if (!result.ok) {
      message.textContent = result.message;
      await refreshBookings();
      return;
    }

    bookings = result.busy || {};
    message.textContent = `${data.get("name")}, запись подтверждена: ${key}, ${selectedSlot}.`;
    selectedSlot = "";
    form.reset();
    renderSlots();
  });

  renderCalendar();
  refreshBookings();
}

document.querySelectorAll("[data-booking-widget]").forEach(createBookingWidget);

const modal = document.querySelector("[data-modal]");
if (modal) {
  const modalImg = modal.querySelector("[data-modal-img]");
  const modalTitle = modal.querySelector("[data-modal-title]");
  document.querySelectorAll("[data-gallery] .gallery-item").forEach((item) => {
    item.addEventListener("click", () => {
      const image = item.querySelector("img");
      modalImg.src = image.src;
      modalImg.alt = image.alt;
      modalTitle.textContent = item.dataset.title;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    });
  });
  modal.querySelector("[data-modal-close]").addEventListener("click", () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.querySelector("[data-modal-close]").click();
  });
}

const filters = document.querySelector("[data-filters]");
if (filters) {
  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    filters.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const filter = button.dataset.filter;
    document.querySelectorAll("[data-gallery] .gallery-item").forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.category !== filter;
    });
  });
}

const slider = document.querySelector("[data-slider]");
if (slider) {
  const slides = [...slider.querySelectorAll(".testimonial")];
  let activeIndex = 0;
  const showSlide = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("active", slideIndex === activeIndex));
  };
  document.querySelector("[data-slider-prev]")?.addEventListener("click", () => showSlide(activeIndex - 1));
  document.querySelector("[data-slider-next]")?.addEventListener("click", () => showSlide(activeIndex + 1));
  setInterval(() => showSlide(activeIndex + 1), 5200);
}
