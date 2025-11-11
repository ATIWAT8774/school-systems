// =================== CONFIG ===================

// เปลี่ยนตรงนี้ให้เป็น URL ของ Web App (Apps Script) ของคุณ
// เช่น  const API_URL = 'https://script.google.com/macros/s/xxxxxxxx/exec';
const API_URL = "https://script.google.com/macros/s/AKfycbwhtqJGKpJ_bEMpq2zbZT1rVDLebuJqL1rPKH_ShHltkdisS_v0K7nJKjsm_UkXmOpf/exec";

// =================== GLOBAL STATE ===================

let currentUser = null;
let allData = [];
let selectedTeacher = null;
let isLoading = false;

// =================== API HELPERS ===================

async function apiGetAll() {
  const res = await fetch(`${API_URL}?action=getAll`, {
    method: "GET",
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "API getAll error");
  }
  return json.data || [];
}

async function apiPost(payload) {
  // ใช้ x-www-form-urlencoded เพื่อตัดปัญหา preflight CORS
  const formData = new URLSearchParams();
  formData.append("payload", JSON.stringify(payload));

  const res = await fetch(API_URL, {
    method: "POST",
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "API error");
  }
  return json.result || {};
}


function apiCreate(entity, item) {
  return apiPost({ action: "create", entity, item });
}

function apiUpdate(entity, item) {
  return apiPost({ action: "update", entity, item });
}

function apiDelete(entity, item) {
  return apiPost({ action: "delete", entity, item });
}

// =================== DATA HELPERS ===================

function getAllUsers() {
  return allData.filter((x) => x.type === "user");
}

function getAllTasks() {
  return allData.filter((x) => x.type === "task");
}

function getAllAnnouncements() {
  return allData.filter((x) => x.type === "announcement");
}

function getAllProblems() {
  return allData.filter((x) => x.type === "problem");
}

async function loadAllDataAndRefresh() {
  try {
    allData = await apiGetAll();
    updateNotificationCounts();
    loadDashboardAnnouncements();

    // รีเฟรชส่วนที่เปิดอยู่
    const trackModal = document.getElementById("trackTasksModal");
    const annModal = document.getElementById("announcementsModal");
    const probModal = document.getElementById("problemsModal");
    const calModal = document.getElementById("calendarModal");
    const repModal = document.getElementById("reportsModal");
    const usersModal = document.getElementById("usersModal");

    if (trackModal && trackModal.classList.contains("active")) loadTasks();
    if (annModal && annModal.classList.contains("active")) loadAnnouncements();
    if (probModal && probModal.classList.contains("active")) loadProblems();
    if (calModal && calModal.classList.contains("active")) loadCalendar();
    if (repModal && repModal.classList.contains("active")) loadReports();
    if (usersModal && usersModal.classList.contains("active")) loadUsers();
  } catch (err) {
    console.error(err);
    showToast("ไม่สามารถโหลดข้อมูลจากเซิร์ฟเวอร์ได้", "error");
  }
}

// =================== ROLE / DISPLAY HELPERS ===================

function getRoleDisplayName(role) {
  const roleNames = {
    admin: "ผู้ดูแลระบบ",
    director: "ผู้อำนวยการ",
    head_budget: "หัวหน้าฝ่ายงบประมาณ",
    head_general: "หัวหน้าฝ่ายบริหารทั่วไป",
    head_academic: "หัวหน้าฝ่ายวิชาการ",
    head_personnel: "หัวหน้าฝ่ายบุคลากร",
    teacher_budget: "ครูฝ่ายงบประมาณ",
    teacher_general: "ครูฝ่ายบริหารทั่วไป",
    teacher_academic: "ครูฝ่ายวิชาการ",
    teacher_personnel: "ครูฝ่ายบุคลากร",
  };
  return roleNames[role] || role;
}

function getDepartmentFromRole(role) {
  if (!role) return "all";
  if (role.includes("budget")) return "budget";
  if (role.includes("general")) return "general";
  if (role.includes("academic")) return "academic";
  if (role.includes("personnel")) return "personnel";
  return "all";
}

function getPriorityText(priority) {
  const priorities = {
    high: "สูง",
    medium: "ปานกลาง",
    low: "ต่ำ",
  };
  return priorities[priority] || priority;
}

function getCategoryText(category) {
  const categories = {
    system: "ระบบ",
    work: "งาน",
    equipment: "อุปกรณ์",
    other: "อื่นๆ",
  };
  return categories[category] || category;
}

// =================== TOAST ===================

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;

  toast.className = `toast ${
    type === "success" ? "toast-success" : "toast-error"
  } active`;

  setTimeout(() => {
    toast.classList.remove("active");
  }, 3000);
}

// =================== LOGIN PAGE ===================

function initLoginPage() {
  const title = document.getElementById("loginSystemTitle");
  const school = document.getElementById("loginSchoolName");
  if (title) title.textContent = "M - SMART"; // <-- แก้ไขเป็น M - SMART
  if (school) school.textContent = "โรงเรียนบ้านหนองระแวง";
  
  // เราอาจเพิ่มการตั้งค่า h2 ด้วย (เผื่อไว้)
  const subtitle = document.getElementById("loginSystemsugtitle");
  if (subtitle) subtitle.textContent = "ระบบมอบหมายและติดตามงาน";

  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isLoading) return;
    isLoading = true;

    const loginBtn = form.querySelector('button[type="submit"]');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = "กำลังเข้าสู่ระบบ...";
    loginBtn.disabled = true;

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    try {
      // โหลดข้อมูลทั้งหมดมาก่อน (เพื่อดึง Users)
      allData = await apiGetAll();
      let allUsers = getAllUsers();

      // 1) เช็ค testAccounts ก่อน ถ้าเจอและยังไม่มีในชีต -> สร้าง user ใหม่
      const testAcc = testAccounts.find(
        (acc) => acc.username === username && acc.password === password
      );

      if (testAcc) {
        let existing = allUsers.find((u) => u.username === username);
        if (!existing) {
          const newUser = {
            id: String(Date.now()),
            type: "user",
            username: testAcc.username,
            password: testAcc.password,
            fullName: testAcc.fullName,
            role: testAcc.role,
            department: testAcc.department,
            createdAt: new Date().toISOString(),
          };
          await apiCreate("user", newUser);
          await loadAllDataAndRefresh();
          allUsers = getAllUsers();
          existing = allUsers.find((u) => u.username === username);
        }

        currentUser = existing;
      } else {
        // 2) เช็ค users ปกติ
        const user = allUsers.find(
          (u) => u.username === username && String(u.password) === password
        );
        if (!user) {
          throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        }
        currentUser = user;
      }

      // เก็บ currentUser ใน localStorage
      localStorage.setItem("currentUser", JSON.stringify(currentUser));

      // ไปหน้า index
      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      showToast(err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ", "error");
    } finally {
      isLoading = false;
      loginBtn.textContent = originalText;
      loginBtn.disabled = false;
    }
  });
}

// =================== DASHBOARD PAGE ===================

function initDashboardPage() {
  // โหลด currentUser จาก localStorage
  const storedUser = localStorage.getItem("currentUser");
  if (!storedUser) {
    // ถ้าไม่มี user ให้กลับไป login
    window.location.href = "login.html";
    return;
  }

  currentUser = JSON.parse(storedUser);

  // เซ็ตชื่อระบบ/โรงเรียน
  const title = document.getElementById("dashboardSystemTitle");
  const school = document.getElementById("dashboardSchoolName");
  const marquee = document.getElementById("marqueeText");

  if (title) title.textContent = "ระบบมอบหมายและติดตามงาน";
  if (school) school.textContent = "โรงเรียนบ้านหนองระแวง";
  if (marquee)
    marquee.textContent =
      "ยินดีต้อนรับสู่ระบบระบบมอบหมายและติดตามงาน โรงเรียนบ้านหนองระแวง";

  // แสดงชื่อ user
  const userNameEl = document.getElementById("currentUserName");
  const userRoleEl = document.getElementById("currentUserRole");
  if (userNameEl) userNameEl.textContent = currentUser.fullName;
  if (userRoleEl) userRoleEl.textContent = getRoleDisplayName(currentUser.role);

  // ปุ่ม logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("currentUser");
      window.location.href = "login.html";
    });
  }

  // เรนเดอร์การ์ดหน้า dashboard
  renderDashboardCards();

  // modal close buttons
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-close-modal");
      closeModal(id);
    });
  });

  // ปุ่ม show/hide panel ย่อยๆ
  const btnShowAddAnnouncement = document.getElementById(
    "btnShowAddAnnouncement"
  );
  const btnHideAddAnnouncement = document.getElementById(
    "btnHideAddAnnouncement"
  );
  const addAnnouncementForm = document.getElementById("addAnnouncementForm");

  if (btnShowAddAnnouncement && addAnnouncementForm) {
    btnShowAddAnnouncement.addEventListener("click", () => {
      addAnnouncementForm.classList.remove("hidden");
    });
  }
  if (btnHideAddAnnouncement && addAnnouncementForm) {
    btnHideAddAnnouncement.addEventListener("click", () => {
      addAnnouncementForm.classList.add("hidden");
      const f = document.getElementById("announcementForm");
      if (f) f.reset();
    });
  }

  const btnShowReportProblem = document.getElementById("btnShowReportProblem");
  const btnHideReportProblem = document.getElementById("btnHideReportProblem");
  const reportProblemForm = document.getElementById("reportProblemForm");

  if (btnShowReportProblem && reportProblemForm) {
    btnShowReportProblem.addEventListener("click", () => {
      reportProblemForm.classList.remove("hidden");
    });
  }
  if (btnHideReportProblem && reportProblemForm) {
    btnHideReportProblem.addEventListener("click", () => {
      reportProblemForm.classList.add("hidden");
      const f = document.getElementById("problemForm");
      if (f) f.reset();
    });
  }

  const btnShowAddUser = document.getElementById("btnShowAddUser");
  const btnHideAddUser = document.getElementById("btnHideAddUser");
  const addUserForm = document.getElementById("addUserForm");

  if (btnShowAddUser && addUserForm) {
    btnShowAddUser.addEventListener("click", () => {
      addUserForm.classList.remove("hidden");
    });
  }
  if (btnHideAddUser && addUserForm) {
    btnHideAddUser.addEventListener("click", () => {
      addUserForm.classList.add("hidden");
      const f = document.getElementById("userForm");
      if (f) f.reset();
    });
  }

  // ปฏิทิน ปุ่มเปลี่ยนเดือน
  const btnPrevMonth = document.getElementById("btnPrevMonth");
  const btnNextMonth = document.getElementById("btnNextMonth");
  const btnToday = document.getElementById("btnToday");

  if (btnPrevMonth) btnPrevMonth.addEventListener("click", () => changeMonth(-1));
  if (btnNextMonth) btnNextMonth.addEventListener("click", () => changeMonth(1));
  if (btnToday) btnToday.addEventListener("click", goToToday);

  // form / filter listeners ต่างๆ
  wireFormsAndFilters();

  // โหลดข้อมูลครั้งแรก
  loadAllDataAndRefresh();
}

// =================== DASHBOARD CARDS ===================

function getCardsForRole(role) {
  const allCards = [
    {
      icon: "📋",
      title: "มอบหมายงาน",
      description: "สร้างและมอบหมายงานใหม่",
      action: "assign",
    },
    {
      icon: "📊",
      title: "ติดตามงาน",
      description: "ดูความคืบหน้าของงาน",
      action: "track",
    },
    {
      icon: "📅",
      title: "ปฏิทิน",
      description: "ดูกำหนดการและเดดไลน์",
      action: "calendar",
    },
    {
      icon: "📢",
      title: "ประกาศ",
      description: "จัดการประกาศและข่าวสาร",
      action: "announcements",
    },
    {
      icon: "📈",
      title: "รายงาน",
      description: "ดูสรุปผลการทำงาน",
      action: "reports",
    },
    {
      icon: "⚠️",
      title: "แจ้งปัญหา",
      description: "รายงานปัญหาและข้อเสนอแนะ",
      action: "problems",
    },
    {
      icon: "👥",
      title: "จัดการผู้ใช้",
      description: "เพิ่ม แก้ไข ลบผู้ใช้งาน",
      action: "users",
    },
  ];

  if (role === "admin") {
    return allCards;
  } else if (role === "director") {
    return allCards.filter((c) => c.action !== "users");
  } else if (role && role.startsWith("head_")) {
    return allCards.filter((c) => !["users"].includes(c.action));
  } else {
    return allCards.filter((c) =>
      ["track", "calendar", "problems"].includes(c.action)
    );
  }
}

function renderDashboardCards() {
  const container = document.getElementById("dashboardCards");
  if (!container) return;
  const cards = getCardsForRole(currentUser.role);

  container.innerHTML = cards
    .map(
      (card) => `
      <div class="card" data-action="${card.action}">
        <div class="card-icon">${card.icon}</div>
        <h3 class="card-title">${card.title}</h3>
        <p class="card-description">${card.description}</p>
      </div>
    `
    )
    .join("");

  container.querySelectorAll(".card").forEach((cardEl) => {
    const action = cardEl.getAttribute("data-action");
    cardEl.addEventListener("click", () => handleCardClick(action));
  });

  updateNotificationCounts();
}

function handleCardClick(action) {
  switch (action) {
    case "assign":
      openModal("assignTaskModal");
      loadTeacherList();
      break;
    case "track":
      openModal("trackTasksModal");
      loadTasks();
      break;
    case "announcements":
      openModal("announcementsModal");
      loadAnnouncements();
      break;
    case "problems":
      openModal("problemsModal");
      loadProblems();
      break;
    case "calendar":
      openModal("calendarModal");
      loadCalendar();
      break;
    case "reports":
      openModal("reportsModal");
      loadReports();
      break;
    case "users":
      openModal("usersModal");
      loadUsers();
      break;
    default:
      showToast(`เปิดหน้า ${action}`, "success");
  }
}

function updateNotificationCounts() {
  if (!currentUser) return;
  const tasks = getAllTasks();
  const myTasks = tasks.filter((t) => t.assignedTo == currentUser.id);
  const pendingTasks = myTasks.filter((t) => t.status === "pending").length;
  const overdueTasks = myTasks.filter((t) => {
    const deadline = new Date(t.deadline);
    const now = new Date();
    return deadline < now && t.status !== "completed";
  }).length;

  setTimeout(() => {
    const trackCard = document.querySelector('.card[data-action="track"]');
    if (trackCard && (pendingTasks > 0 || overdueTasks > 0)) {
      const titleEl = trackCard.querySelector(".card-title");
      if (!titleEl) return;
      const existing = titleEl.querySelector(".notification-badge");
      if (existing) existing.remove();

      const badge = document.createElement("span");
      badge.className = "notification-badge";
      badge.textContent = pendingTasks + overdueTasks;
      titleEl.appendChild(badge);
    }
  }, 100);
}


// =================== DASHBOARD ANNOUNCEMENTS ===================

function loadDashboardAnnouncements() {
  // ดึงประกาศทั้งหมดมาเรียงตามวันที่ใหม่สุดไปเก่าสุด
  const announcements = getAllAnnouncements().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const users = getAllUsers();
  const listEl = document.getElementById("dashboardAnnouncements");
  if (!listEl) return;

  if (!announcements.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📢</div>
        <p>ยังไม่มีประกาศ</p>
      </div>
    `;
    return;
  }

  // แสดงประกาศล่าสุด 5 รายการ
  const recentAnnouncements = announcements.slice(0, 5);

  listEl.innerHTML = recentAnnouncements
    .map((a) => {
      const author = users.find((u) => String(u.id) === String(a.assignedBy));
      return `
        <div class="task-card">
          <div class="task-header">
            <h4 class="task-title">${a.title}</h4>
          </div>
          <p style="color:#666;margin:8px 0;line-height:1.6;">${a.message}</p>
          <div class="task-meta">
            <div>โดย: ${author ? author.fullName : "ไม่ระบุ"}</div>
            <div>วันที่: ${new Date(a.createdAt).toLocaleDateString("th-TH")}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

// =================== MODAL HELPERS ===================

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("active");
}

// =================== ASSIGN TASKS ===================

function loadTeacherList() {
  const depSelect = document.getElementById("taskDepartment");
  const listEl = document.getElementById("teacherList");
  if (!depSelect || !listEl) return;

  const department = depSelect.value;
  if (!department) {
    listEl.innerHTML =
      '<p style="color:#81C784;text-align:center;">กรุณาเลือกฝ่ายก่อน</p>';
    return;
  }

  const allUsers = getAllUsers();
  let teachers = [];

  if (currentUser.role === "director" || currentUser.role === "admin") {
    teachers = allUsers.filter(
      (u) =>
        (u.role.startsWith("head_") || u.role.startsWith("teacher_")) &&
        getDepartmentFromRole(u.role) === department
    );
  } else if (currentUser.role.startsWith("head_")) {
    teachers = allUsers.filter(
      (u) =>
        u.role.startsWith("teacher_") &&
        getDepartmentFromRole(u.role) === department
    );
  }

  if (!teachers.length) {
    listEl.innerHTML =
      '<p style="color:#81C784;text-align:center;">ไม่พบผู้ใช้ในฝ่ายนี้</p>';
    return;
  }

  listEl.innerHTML = teachers
    .map(
      (t) => `
        <div class="teacher-item" data-teacher-id="${t.id}">
          <span>👤</span>
          <span>${t.fullName} (${getRoleDisplayName(t.role)})</span>
        </div>
      `
    )
    .join("");

  listEl.querySelectorAll(".teacher-item").forEach((item) => {
    item.addEventListener("click", (ev) => {
      selectedTeacher = item.getAttribute("data-teacher-id");
      listEl.querySelectorAll(".teacher-item").forEach((i) =>
        i.classList.remove("selected")
      );
      item.classList.add("selected");
    });
  });
}

function wireFormsAndFilters() {
  const depSelect = document.getElementById("taskDepartment");
  if (depSelect) depSelect.addEventListener("change", loadTeacherList);

  // form มอบหมายงาน
  const assignForm = document.getElementById("assignTaskForm");
  if (assignForm) {
    assignForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isLoading) return;

      if (!selectedTeacher) {
        showToast("กรุณาเลือกผู้รับผิดชอบ", "error");
        return;
      }

      if (getAllTasks().length >= 999) {
        showToast(
          "ไม่สามารถสร้างงานใหม่ได้ เนื่องจากถึงขีดจำกัดแล้ว",
          "error"
        );
        return;
      }

      isLoading = true;
      const submitBtn = document.getElementById("assignTaskBtn");
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "กำลังมอบหมายงาน...";
      submitBtn.disabled = true;

      try {
        const newTask = {
          id: String(Date.now()),
          type: "task",
          title: document.getElementById("taskTitle").value,
          description: document.getElementById("taskDescription").value,
          deadline: document.getElementById("taskDeadline").value,
          priority: document.getElementById("taskPriority").value,
          assignedTo: selectedTeacher,
          assignedBy: currentUser.id,
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        await apiCreate("task", newTask);
        showToast("มอบหมายงานสำเร็จ", "success");

        assignForm.reset();
        selectedTeacher = null;
        const tl = document.getElementById("teacherList");
        if (tl) tl.innerHTML = "";
        closeModal("assignTaskModal");
        await loadAllDataAndRefresh();
      } catch (err) {
        console.error(err);
        showToast("เกิดข้อผิดพลาดในการมอบหมายงาน", "error");
      } finally {
        isLoading = false;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

// filters tasks
  const depFilter = document.getElementById("departmentFilter");
  if (depFilter) depFilter.addEventListener("change", loadTeachersForTracking);

  // form ประกาศ
  const annForm = document.getElementById("announcementForm");
  if (annForm) {
    annForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isLoading) return;

      if (getAllAnnouncements().length >= 999) {
        showToast(
          "ไม่สามารถสร้างประกาศใหม่ได้ เนื่องจากถึงขีดจำกัดแล้ว",
          "error"
        );
        return;
      }

      isLoading = true;
      const submitBtn = annForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "กำลังเผยแพร่...";
      submitBtn.disabled = true;

      try {
        const newAnnouncement = {
          id: String(Date.now()),
          type: "announcement",
          title: document.getElementById("announcementTitle").value,
          message: document.getElementById("announcementMessage").value,
          assignedBy: currentUser.id,
          createdAt: new Date().toISOString(),
        };

        await apiCreate("announcement", newAnnouncement);
        showToast("เผยแพร่ประกาศสำเร็จ", "success");
        annForm.reset();
        const panel = document.getElementById("addAnnouncementForm");
        if (panel) panel.classList.add("hidden");
        await loadAllDataAndRefresh();
      } catch (err) {
        console.error(err);
        showToast("เกิดข้อผิดพลาดในการเผยแพร่ประกาศ", "error");
      } finally {
        isLoading = false;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // form ปัญหา
  const problemForm = document.getElementById("problemForm");
  if (problemForm) {
    problemForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isLoading) return;

      if (getAllProblems().length >= 999) {
        showToast(
          "ไม่สามารถส่งรายงานใหม่ได้ เนื่องจากถึงขีดจำกัดแล้ว",
          "error"
        );
        return;
      }

      isLoading = true;
      const submitBtn = problemForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "กำลังส่งรายงาน...";
      submitBtn.disabled = true;

      try {
        const newProblem = {
          id: String(Date.now()),
          type: "problem",
          category: document.getElementById("problemCategory").value,
          message: document.getElementById("problemMessage").value,
          assignedBy: currentUser.id,
          createdAt: new Date().toISOString(),
        };

        await apiCreate("problem", newProblem);
        showToast("ส่งรายงานปัญหาสำเร็จ", "success");
        problemForm.reset();
        const panel = document.getElementById("reportProblemForm");
        if (panel) panel.classList.add("hidden");
        await loadAllDataAndRefresh();
      } catch (err) {
        console.error(err);
        showToast("เกิดข้อผิดพลาดในการส่งรายงาน", "error");
      } finally {
        isLoading = false;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // form เพิ่มผู้ใช้
  const userForm = document.getElementById("userForm");
  if (userForm) {
    userForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isLoading) return;

      if (getAllUsers().length >= 999) {
        showToast(
          "ไม่สามารถเพิ่มผู้ใช้ใหม่ได้ เนื่องจากถึงขีดจำกัดแล้ว",
          "error"
        );
        return;
      }

      isLoading = true;
      const submitBtn = userForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "กำลังเพิ่มผู้ใช้...";
      submitBtn.disabled = true;

      try {
        const username = document.getElementById("newUsername").value.trim();
        const allUsers = getAllUsers();
        if (allUsers.find((u) => u.username === username)) {
          throw new Error("ชื่อผู้ใช้นี้มีอยู่แล้ว");
        }

        const role = document.getElementById("newRole").value;

        const newUser = {
          id: String(Date.now()),
          type: "user",
          username,
          password: document.getElementById("newPassword").value,
          fullName: document.getElementById("newFullName").value,
          role,
          department: getDepartmentFromRole(role),
          createdAt: new Date().toISOString(),
        };

        await apiCreate("user", newUser);
        showToast("เพิ่มผู้ใช้สำเร็จ", "success");
        userForm.reset();
        const panel = document.getElementById("addUserForm");
        if (panel) panel.classList.add("hidden");
        await loadAllDataAndRefresh();
      } catch (err) {
        console.error(err);
        showToast(
          err.message || "เกิดข้อผิดพลาดในการเพิ่มผู้ใช้",
          "error"
        );
      } finally {
        isLoading = false;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
}

// =================== TASKS LIST / DETAIL ===================

// =================== TASKS LIST / DETAIL (โฉมใหม่) ===================

// (แทนที่ loadTasks เดิม)
function loadTeachersForTracking() {
  const users = getAllUsers();
  const tasks = getAllTasks();
  
  const depFilter = document.getElementById("departmentFilter");
  const depValue = depFilter ? depFilter.value : "";
  
  const listEl = document.getElementById("teacherListContainer");
  if (!listEl) return;

  if (!depValue) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <p>กรุณาเลือกฝ่ายเพื่อแสดงรายชื่อครู</p>
      </div>
    `;
    return;
  }

  // กรองครูเฉพาะในฝ่ายที่เลือก
  const teachers = users.filter(
    (u) => getDepartmentFromRole(u.role) === depValue && u.role.startsWith('teacher_')
  );
   const heads = users.filter(
    (u) => getDepartmentFromRole(u.role) === depValue && u.role.startsWith('head_')
  );
  
  // รวมหัวหน้าและครู
  const departmentUsers = [...heads, ...teachers];

  if (!departmentUsers.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <p>ไม่พบผู้ใช้ในฝ่ายนี้</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = departmentUsers
    .map((user) => {
      // นับงานของแต่ละคน
      const userTasks = tasks.filter((t) => String(t.assignedTo) === String(user.id));
      const pendingCount = userTasks.filter((t) => t.status !== "completed").length;
      
      return `
        <div class="user-card"> <div class="user-info-card">
            <div class="user-avatar">${user.fullName.charAt(0)}</div>
            <div class="user-details-card">
              <p class="user-name-card">${user.fullName}</p>
              <p class="user-role-card">${getRoleDisplayName(user.role)}</p>
            </div>
          </div>
          <div style="text-align:right;">
            <button class="btn btn-primary" data-teacher-id="${user.id}" data-teacher-name="${user.fullName}">
              ดูภาระงาน (${pendingCount}/${userTasks.length})
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // เพิ่ม Event Listeners ให้ปุ่ม "ดูภาระงาน"
  listEl.querySelectorAll("button[data-teacher-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-teacher-id");
      const name = btn.getAttribute("data-teacher-name");
      showTeacherWorkload(id, name);
    });
  });
}

// (ฟังก์ชันใหม่)
function showTeacherWorkload(teacherId, teacherName) {
  const titleEl = document.getElementById("teacherWorkloadTitle");
  if (titleEl) titleEl.textContent = `ภาระงานของ: ${teacherName}`;

  const listEl = document.getElementById("teacherWorkloadList");
  if (!listEl) return;

  const allTasks = getAllTasks();
  const tasks = allTasks.filter((t) => String(t.assignedTo) === String(teacherId));
  
  if (!tasks.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>ไม่พบงานที่ได้รับมอบหมาย</p>
      </div>
    `;
    openModal("teacherWorkloadModal");
    return;
  }

  // (นี่คือ renderTasks เวอร์ชันใหม่ ที่ไม่มี "มอบหมายโดย")
  const now = new Date();
  listEl.innerHTML = tasks
    .map((task) => {
      const deadline = new Date(task.deadline);
      const isOverdue = deadline < now && task.status !== "completed";

      let statusClass = "status-progress";
      let statusText = "รอดำเนินการ";

      if (task.status === "completed") {
        statusClass = "status-completed";
        statusText = "เสร็จสิ้น";
      } else if (task.status === "in_progress") {
        statusClass = "status-progress";
        statusText = "กำลังดำเนินการ";
      } else if (isOverdue) {
        statusClass = "status-overdue";
        statusText = "เกินกำหนด";
      }

      return `
        <div class="task-card" data-task-id="${task.id}">
          <div class="task-header">
            <h4 class="task-title">${task.title}</h4>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
          <p style="color:#666;margin:8px 0;">${task.description}</p>
          <div class="task-meta">
            <div>กำหนดส่ง: ${new Date(task.deadline).toLocaleDateString("th-TH")}</div>
            <div>ความสำคัญ: ${getPriorityText(task.priority)}</div>
          </div>
        </div>
      `;
    })
    .join("");

  listEl.querySelectorAll(".task-card").forEach((el) => {
    const id = el.getAttribute("data-task-id");
    el.addEventListener("click", () => showTaskDetail(id));
  });

  openModal("teacherWorkloadModal");
}

function showTaskDetail(taskId) {
  const tasks = getAllTasks();
  const users = getAllUsers();
  const task = tasks.find((t) => String(t.id) === String(taskId));
  if (!task) return;

  const assignedUser = users.find((u) => String(u.id) === String(task.assignedTo));
  // เราไม่แสดง assignedByUser อีกต่อไป

  const deadline = new Date(task.deadline);
  const now = new Date();
  const isOverdue = deadline < now && task.status !== "completed";

  let statusText = "รอดำเนินการ";
  if (task.status === "completed") statusText = "เสร็จสิ้น";
  else if (task.status === "in_progress") statusText = "กำลังดำเนินการ";
  else if (isOverdue) statusText = "เกินกำหนด";

  const contentEl = document.getElementById("taskDetailContent");
  const actionsEl = document.getElementById("taskActions");
  const fileLinkEl = document.getElementById("fileLinkArea");
  const fileUploadEl = document.getElementById("fileUploadArea");

  // 1. Render Content (ลบ "มอบหมายโดย")
  if (contentEl) {
    contentEl.innerHTML = `
      <div style="margin-bottom:20px;">
        <h3 style="color:#2E7D32;margin-bottom:16px;">${task.title}</h3>
        <div style="background:#F1F8E9;padding:16px;border-radius:8px;margin-bottom:16px;">
          <p style="margin:0;line-height:1.6;">${task.description}</p>
        </div>
        <div style="display:grid;gap:12px;">
          <div><strong>สถานะ:</strong> ${statusText}</div>
          <div><strong>ผู้รับผิดชอบ:</strong> ${assignedUser ? assignedUser.fullName : "ไม่ระบุ"}</div>
          <div><strong>กำหนดส่ง:</strong> ${deadline.toLocaleDateString("th-TH")}</div>
          <div><strong>ความสำคัญ:</strong> ${getPriorityText(task.priority)}</div>
          <div><strong>วันที่สร้าง:</strong> ${new Date(task.createdAt).toLocaleDateString("th-TH")}</div>
          ${
            task.completedAt
              ? `<div><strong>วันที่เสร็จสิ้น:</strong> ${new Date(
                  task.completedAt
                ).toLocaleDateString("th-TH")}</div>`
              : ""
          }
        </div>
      </div>
    `;
  }
  
  // 2. Render File Link (ถ้ามี)
  if (fileLinkEl) {
    if (task.fileLink) {
      fileLinkEl.innerHTML = `
        <h4 style="color:#2E7D32;margin-bottom:10px;">ไฟล์งานที่ส่งแล้ว</h4>
        <a href="${task.fileLink}" target="_blank" class="btn btn-secondary">
          เปิดไฟล์งาน (PDF)
        </a>`;
      fileLinkEl.style.display = 'block';
    } else {
      fileLinkEl.innerHTML = '';
      fileLinkEl.style.display = 'none';
    }
  }

  // 3. Render Action Buttons
  if (actionsEl) {
    let html = "";
    if (String(task.assignedTo) === String(currentUser.id) && task.status !== "completed") {
      if (task.status === "pending") {
        html += `<button class="btn btn-primary" data-action="start">เริ่มทำงาน</button>`;
      }
      if (task.status === "in_progress") {
        html += `<button class="btn btn-primary" data-action="complete">ทำเสร็จแล้ว</button>`;
      }
    }

    if (
      String(task.assignedBy) === String(currentUser.id) ||
      currentUser.role === "director" ||
      currentUser.role === "admin"
    ) {
      html += `<button class="btn btn-danger" data-action="delete">ลบงาน</button>`;
    }
    actionsEl.innerHTML = html;

    // ... (event listeners เดิมสำหรับ start, complete, delete) ...
    actionsEl
      .querySelectorAll("button[data-action]")
      .forEach((btn) => {
        const act = btn.getAttribute("data-action");
        if (act === "start") {
          btn.addEventListener("click", () =>
            updateTaskStatus(task.id, "in_progress")
          );
        } else if (act === "complete") {
          btn.addEventListener("click", () =>
            updateTaskStatus(task.id, "completed")
          );
        } else if (act === "delete") {
          btn.addEventListener("click", () => deleteTask(task.id, btn));
        }
      });
  }
  
  // 4. Handle File Upload Area
  if (fileUploadEl) {
    const uploadBtn = document.getElementById("submitFileButton");
    const fileInput = document.getElementById("taskFileInput");
    const uploadStatus = document.getElementById("uploadStatus");

    // รีเซ็ตค่าเก่า
    fileInput.value = null;
    uploadStatus.textContent = '';
    
    // แสดง/ซ่อน ส่วนอัปโหลด
    if (String(task.assignedTo) === String(currentUser.id) && task.status !== "completed") {
      fileUploadEl.style.display = 'block';
    } else {
      fileUploadEl.style.display = 'none';
    }
    
    // ลบ listener เก่าออกก่อน
    const newUploadBtn = uploadBtn.cloneNode(true);
    uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
    
    // เพิ่ม listener ใหม่
    newUploadBtn.addEventListener('click', () => {
      handleFileSubmit(task.id, fileInput, uploadStatus);
    });
  }

  openModal("taskDetailModal");
}

async function updateTaskStatus(taskId, newStatus) {
  if (isLoading) return;
  isLoading = true;
  try {
    const tasks = getAllTasks();
    const task = tasks.find((t) => String(t.id) === String(taskId));
    if (!task) throw new Error("ไม่พบงานที่ต้องการอัปเดต");

    const updatedTask = { ...task, status: newStatus };
    if (newStatus === "completed") {
      updatedTask.completedAt = new Date().toISOString();
    }

    await apiUpdate("task", updatedTask);
    showToast("อัปเดตสถานะงานสำเร็จ", "success");
    closeModal("taskDetailModal");
    await loadAllDataAndRefresh();
  } catch (err) {
    console.error(err);
    showToast("เกิดข้อผิดพลาดในการอัปเดตสถานะ", "error");
  } finally {
    isLoading = false;
  }
}

async function deleteTask(taskId, btnEl) {
  if (isLoading) return;

  if (!btnEl.dataset.confirmed) {
    btnEl.dataset.confirmed = "true";
    const original = btnEl.textContent;
    btnEl.textContent = "คลิกอีกครั้งเพื่อยืนยัน";
    const originalBg = btnEl.style.background;
    btnEl.style.background = "#D32F2F";

    setTimeout(() => {
      btnEl.dataset.confirmed = "";
      btnEl.textContent = original;
      btnEl.style.background = originalBg;
    }, 3000);
    return;
  }

  isLoading = true;
  try {
    const tasks = getAllTasks();
    const task = tasks.find((t) => String(t.id) === String(taskId));
    if (!task) throw new Error("ไม่พบงาน");

    await apiDelete("task", { id: task.id, type: "task" });
    showToast("ลบงานสำเร็จ", "success");
    closeModal("taskDetailModal");
    await loadAllDataAndRefresh();
  } catch (err) {
    console.error(err);
    showToast("เกิดข้อผิดพลาดในการลบงาน", "error");
  } finally {
    isLoading = false;
    btnEl.dataset.confirmed = "";
  }
}

// (ฟังก์ชันใหม่)
async function handleFileSubmit(taskId, fileInput, statusEl) {
  if (isLoading) return;
  const file = fileInput.files[0];

  if (!file) {
    showToast("กรุณาเลือกไฟล์ PDF", "error");
    return;
  }

  if (file.type !== "application/pdf") {
    showToast("กรุณาเลือกไฟล์ .pdf เท่านั้น", "error");
    return;
  }

  if (file.size > 10 * 1024 * 1024) { // จำกัดขนาดไฟล์ 10MB
    showToast("ไฟล์ต้องมีขนาดไม่เกิน 10MB", "error");
    return;
  }
  
  isLoading = true;
  statusEl.textContent = 'กำลังอัปโหลด...';

  try {
    // 1. อ่านไฟล์เป็น Base64
    const fileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

    // 2. สร้าง payload
    const payload = {
      action: "uploadFile",
      taskId: taskId,
      fileName: file.name,
      mimeType: file.type,
      fileData: fileData,
    };

    // 3. ส่งไปที่ API (doPost)
    const resultTask = await apiPost(payload);
    
    // 4. อัปเดตข้อมูลใน allData (สำคัญมาก)
    const taskIndex = allData.findIndex(t => t.type === 'task' && String(t.id) === String(taskId));
    if (taskIndex > -1) {
      allData[taskIndex] = { ...allData[taskIndex], ...resultTask };
    }

    showToast("อัปโหลดไฟล์สำเร็จ", "success");
    statusEl.textContent = 'อัปโหลดสำเร็จ!';
    
    // รีเฟรชหน้าต่างรายละเอียดงานเพื่อแสดงลิงก์
    showTaskDetail(taskId); 

  } catch (err) {
    console.error(err);
    showToast(err.message || "เกิดข้อผิดพลาดในการอัปโหลด", "error");
    statusEl.textContent = 'อัปโหลดล้มเหลว';
  } finally {
    isLoading = false;
  }
}

// =================== ANNOUNCEMENTS ===================

function canDeleteAnnouncement(announcement) {
  return (
    String(announcement.assignedBy) === String(currentUser.id) ||
    currentUser.role === "director" ||
    currentUser.role === "admin"
  );
}

function loadAnnouncements() {
  const announcements = getAllAnnouncements();
  const users = getAllUsers();
  const listEl = document.getElementById("announcementsList");
  if (!listEl) return;

  if (!announcements.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📢</div>
        <p>ยังไม่มีประกาศ</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = announcements
    .map((a) => {
      const author = users.find((u) => String(u.id) === String(a.assignedBy));
      return `
        <div class="task-card">
          <div class="task-header">
            <h4 class="task-title">${a.title}</h4>
            ${
              canDeleteAnnouncement(a)
                ? `<button class="btn btn-danger" style="padding:4px 8px;font-size:12px;" data-ann-id="${a.id}">ลบ</button>`
                : ""
            }
          </div>
          <p style="color:#666;margin:8px 0;line-height:1.6;">${a.message}</p>
          <div class="task-meta">
            <div>โดย: ${author ? author.fullName : "ไม่ระบุ"}</div>
            <div>วันที่: ${new Date(a.createdAt).toLocaleDateString("th-TH")}</div>
          </div>
        </div>
      `;
    })
    .join("");

  listEl
    .querySelectorAll("button[data-ann-id]")
    .forEach((btn) => {
      const id = btn.getAttribute("data-ann-id");
      btn.addEventListener("click", () => deleteAnnouncement(id, btn));
    });
}

async function deleteAnnouncement(id, btnEl) {
  if (isLoading) return;

  if (!btnEl.dataset.confirmed) {
    btnEl.dataset.confirmed = "true";
    const original = btnEl.textContent;
    btnEl.textContent = "คลิกอีกครั้งเพื่อยืนยัน";
    const originalBg = btnEl.style.background;
    btnEl.style.background = "#D32F2F";

    setTimeout(() => {
      btnEl.dataset.confirmed = "";
      btnEl.textContent = original;
      btnEl.style.background = originalBg;
    }, 3000);
    return;
  }

  isLoading = true;
  try {
    await apiDelete("announcement", { id, type: "announcement" });
    showToast("ลบประกาศสำเร็จ", "success");
    await loadAllDataAndRefresh();
  } catch (err) {
    console.error(err);
    showToast("เกิดข้อผิดพลาดในการลบประกาศ", "error");
  } finally {
    isLoading = false;
    btnEl.dataset.confirmed = "";
  }
}

// =================== PROBLEMS ===================

function canDeleteProblem(problem) {
  return (
    String(problem.assignedBy) === String(currentUser.id) ||
    currentUser.role === "director" ||
    currentUser.role === "admin"
  );
}

function loadProblems() {
  const problems = getAllProblems();
  const users = getAllUsers();
  const listEl = document.getElementById("problemsList");
  if (!listEl) return;

  let filtered = problems;
  if (!["admin", "director"].includes(currentUser.role)) {
    filtered = problems.filter(
      (p) => String(p.assignedBy) === String(currentUser.id)
    );
  }

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p>ไม่มีรายงานปัญหา</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered
    .map((p) => {
      const reporter = users.find(
        (u) => String(u.id) === String(p.assignedBy)
      );
      return `
        <div class="task-card">
          <div class="task-header">
            <h4 class="task-title">ปัญหา${getCategoryText(p.category)}</h4>
            ${
              canDeleteProblem(p)
                ? `<button class="btn btn-danger" style="padding:4px 8px;font-size:12px;" data-prob-id="${p.id}">ลบ</button>`
                : ""
            }
          </div>
          <p style="color:#666;margin:8px 0;line-height:1.6;">${p.message}</p>
          <div class="task-meta">
            <div>รายงานโดย: ${reporter ? reporter.fullName : "ไม่ระบุ"}</div>
            <div>วันที่: ${new Date(p.createdAt).toLocaleDateString("th-TH")}</div>
          </div>
        </div>
      `;
    })
    .join("");

  listEl
    .querySelectorAll("button[data-prob-id]")
    .forEach((btn) => {
      const id = btn.getAttribute("data-prob-id");
      btn.addEventListener("click", () => deleteProblem(id, btn));
    });
}

async function deleteProblem(id, btnEl) {
  if (isLoading) return;

  if (!btnEl.dataset.confirmed) {
    btnEl.dataset.confirmed = "true";
    const original = btnEl.textContent;
    btnEl.textContent = "คลิกอีกครั้งเพื่อยืนยัน";
    const originalBg = btnEl.style.background;
    btnEl.style.background = "#D32F2F";

    setTimeout(() => {
      btnEl.dataset.confirmed = "";
      btnEl.textContent = original;
      btnEl.style.background = originalBg;
    }, 3000);
    return;
  }

  isLoading = true;
  try {
    await apiDelete("problem", { id, type: "problem" });
    showToast("ลบรายงานสำเร็จ", "success");
    await loadAllDataAndRefresh();
  } catch (err) {
    console.error(err);
    showToast("เกิดข้อผิดพลาดในการลบรายงาน", "error");
  } finally {
    isLoading = false;
    btnEl.dataset.confirmed = "";
  }
}

// =================== CALENDAR ===================

let currentCalendarDate = new Date();

function loadCalendar() {
  renderCalendar();
  loadUpcomingTasks();
}

function renderCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const monthNames = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];

  const monthEl = document.getElementById("currentMonth");
  if (monthEl) {
    monthEl.textContent = `${monthNames[month]} ${year + 543}`;
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const tasks = getAllTasks();
  const monthTasks = tasks.filter((t) => {
    const d = new Date(t.deadline);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const calEl = document.getElementById("calendar");
  if (!calEl) return;

  let html = "";
  const dayHeaders = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  dayHeaders.forEach((day) => {
    html += `<div class="calendar-header">${day}</div>`;
  });

  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();

  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    html += `
      <div class="calendar-day other-month">
        <div class="day-number">${day}</div>
      </div>
    `;
  }

  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const isToday = currentDate.toDateString() === today.toDateString();

    const dayTasks = monthTasks.filter((t) => {
      const d = new Date(t.deadline);
      return d.getDate() === day;
    });

    let dayClass = "calendar-day";
    if (isToday) dayClass += " today";
    if (dayTasks.length > 0) dayClass += " has-tasks";

    let dots = "";
    dayTasks.forEach((t) => {
      const isOverdue =
        new Date(t.deadline) < today && t.status !== "completed";
      dots += `<span class="task-dot${isOverdue ? " overdue" : ""}"></span>`;
    });

    html += `
      <div class="${dayClass}">
        <div class="day-number">${day}</div>
        <div>${dots}</div>
      </div>
    `;
  }

  const totalCells = Math.ceil((startingDayOfWeek + daysInMonth) / 7) * 7;
  const remainingCells = totalCells - (startingDayOfWeek + daysInMonth);
  for (let day = 1; day <= remainingCells; day++) {
    html += `
      <div class="calendar-day other-month">
        <div class="day-number">${day}</div>
      </div>
    `;
  }

  calEl.innerHTML = html;
}

function loadUpcomingTasks() {
  const tasks = getAllTasks();
  const users = getAllUsers();
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  let upcoming = tasks.filter((t) => {
    const d = new Date(t.deadline);
    return d >= today && d <= nextWeek && t.status !== "completed";
  });

  if (currentUser.role.startsWith("teacher_")) {
    upcoming = upcoming.filter((t) => String(t.assignedTo) === String(currentUser.id));
  } else if (currentUser.role.startsWith("head_")) {
    const deptUsers = users.filter(
      (u) => getDepartmentFromRole(u.role) === currentUser.department
    );
    const deptIds = deptUsers.map((u) => String(u.id));
    upcoming = upcoming.filter(
      (t) =>
        deptIds.includes(String(t.assignedTo)) ||
        String(t.assignedBy) === String(currentUser.id)
    );
  }

  upcoming.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const container = document.getElementById("upcomingTasks");
  if (!container) return;

  if (!upcoming.length) {
    container.innerHTML =
      '<p style="color:#81C784;text-align:center;">ไม่มีงานที่กำลังจะถึงกำหนดในสัปดาห์นี้</p>';
    return;
  }

  container.innerHTML = upcoming
    .map((task) => {
      const assignedUser = users.find(
        (u) => String(u.id) === String(task.assignedTo)
      );
      const daysLeft = Math.ceil(
        (new Date(task.deadline) - today) / (1000 * 60 * 60 * 24)
      );
      let textDays = "";
      if (daysLeft === 0) textDays = "วันนี้";
      else if (daysLeft === 1) textDays = "พรุ่งนี้";
      else textDays = `อีก ${daysLeft} วัน`;

      const priorityClass =
        task.priority === "high" ? "status-overdue" : "status-progress";

      return `
        <div class="task-card" style="margin-bottom:8px;padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <strong style="color:#2E7D32;">${task.title}</strong>
              <div style="font-size:12px;color:#666;">
                ${assignedUser ? assignedUser.fullName : "ไม่ระบุ"} • ${textDays}
              </div>
            </div>
            <span class="status-badge ${priorityClass}" style="font-size:10px;">
              ${getPriorityText(task.priority)}
            </span>
          </div>
        </div>
      `;
    })
    .join("");
}

function changeMonth(direction) {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
  renderCalendar();
  loadUpcomingTasks();
}

function goToToday() {
  currentCalendarDate = new Date();
  renderCalendar();
  loadUpcomingTasks();
}

// =================== REPORTS ===================

function loadReports() {
  const tasks = getAllTasks();
  const users = getAllUsers();
  const today = new Date();

  let visibleTasks = tasks;
  if (currentUser.role.startsWith("teacher_")) {
    visibleTasks = tasks.filter((t) => String(t.assignedTo) === String(currentUser.id));
  } else if (currentUser.role.startsWith("head_")) {
    const deptUsers = users.filter(
      (u) => getDepartmentFromRole(u.role) === currentUser.department
    );
    const deptIds = deptUsers.map((u) => String(u.id));
    visibleTasks = tasks.filter(
      (t) =>
        deptIds.includes(String(t.assignedTo)) ||
        String(t.assignedBy) === String(currentUser.id)
    );
  }

  const totalTasks = visibleTasks.length;
  const pending = visibleTasks.filter((t) => t.status === "pending").length;
  const inProgress = visibleTasks.filter(
    (t) => t.status === "in_progress"
  ).length;
  const completed = visibleTasks.filter(
    (t) => t.status === "completed"
  ).length;
  const overdue = visibleTasks.filter((t) => {
    const d = new Date(t.deadline);
    return d < today && t.status !== "completed";
  }).length;

  const totalEl = document.getElementById("totalTasks");
  const pendEl = document.getElementById("pendingTasks");
  const inProgEl = document.getElementById("inProgressTasks");
  const compEl = document.getElementById("completedTasks");
  const overEl = document.getElementById("overdueTasks");

  if (totalEl) totalEl.textContent = totalTasks;
  if (pendEl) pendEl.textContent = pending;
  if (inProgEl) inProgEl.textContent = inProgress;
  if (compEl) compEl.textContent = completed;
  if (overEl) overEl.textContent = overdue;

  // สถิติตามฝ่าย
  const departments = ["budget", "general", "academic", "personnel"];
  const departmentNames = {
    budget: "ฝ่ายงบประมาณ",
    general: "ฝ่ายบริหารทั่วไป",
    academic: "ฝ่ายวิชาการ",
    personnel: "ฝ่ายบุคลากร",
  };

  let deptHTML = "";
  departments.forEach((dept) => {
    const deptUsers = users.filter(
      (u) => getDepartmentFromRole(u.role) === dept
    );
    const deptIds = deptUsers.map((u) => String(u.id));
    const deptTasks = visibleTasks.filter((t) =>
      deptIds.includes(String(t.assignedTo))
    );
    const deptCompleted = deptTasks.filter(
      (t) => t.status === "completed"
    ).length;
    const rate =
      deptTasks.length > 0
        ? Math.round((deptCompleted / deptTasks.length) * 100)
        : 0;

    deptHTML += `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #E8F5E9;">
        <span>${departmentNames[dept]}</span>
        <div style="text-align:right;">
          <div style="font-weight:600;color:#2E7D32;">${rate}%</div>
          <div style="font-size:12px;color:#666;">${deptCompleted}/${deptTasks.length}</div>
        </div>
      </div>
    `;
  });

  const deptStatsEl = document.getElementById("departmentStats");
  if (deptStatsEl) deptStatsEl.innerHTML = deptHTML;

  // ประสิทธิภาพการทำงาน
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthTasks = visibleTasks.filter(
    (t) => new Date(t.createdAt) >= thisMonth
  );
  const thisMonthCompleted = thisMonthTasks.filter(
    (t) => t.status === "completed"
  ).length;
  const monthlyRate =
    thisMonthTasks.length > 0
      ? Math.round((thisMonthCompleted / thisMonthTasks.length) * 100)
      : 0;

  const avgTime = calculateAverageCompletionTime(
    visibleTasks.filter((t) => t.status === "completed")
  );

  const perfEl = document.getElementById("performanceStats");
  if (perfEl) {
    perfEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #E8F5E9;">
        <span>อัตราการทำงานเสร็จเดือนนี้</span>
        <span style="font-weight:600;color:#2E7D32;">${monthlyRate}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #E8F5E9;">
        <span>งานใหม่เดือนนี้</span>
        <span style="font-weight:600;color:#2E7D32;">${thisMonthTasks.length}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
        <span>เวลาเฉลี่ยในการทำงาน</span>
        <span style="font-weight:600;color:#2E7D32;">${avgTime} วัน</span>
      </div>
    `;
  }

  // งานที่เกินกำหนด
  const overdueList = visibleTasks.filter((t) => {
    const d = new Date(t.deadline);
    return d < today && t.status !== "completed";
  });

  const overListEl = document.getElementById("overdueTasksList");
  if (!overListEl) return;

  if (!overdueList.length) {
    overListEl.innerHTML =
      '<p style="color:#81C784;text-align:center;">ไม่มีงานที่เกินกำหนด</p>';
  } else {
    overListEl.innerHTML = overdueList
      .map((task) => {
        const assignedUser = users.find(
          (u) => String(u.id) === String(task.assignedTo)
        );
        const daysOver = Math.ceil(
          (today - new Date(task.deadline)) / (1000 * 60 * 60 * 24)
        );
        return `
          <div class="task-card" style="margin-bottom:8px;padding:12px;border-left-color:#EF5350;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <strong style="color:#C62828;">${task.title}</strong>
                <div style="font-size:12px;color:#666;">
                  ${assignedUser ? assignedUser.fullName : "ไม่ระบุ"} • เกินกำหนด ${daysOver} วัน
                </div>
              </div>
              <span class="status-badge status-overdue" style="font-size:10px;">
                ${getPriorityText(task.priority)}
              </span>
            </div>
          </div>
        `;
      })
      .join("");
  }
}

function calculateAverageCompletionTime(completedTasks) {
  if (!completedTasks.length) return 0;
  const totalDays = completedTasks.reduce((sum, t) => {
    const created = new Date(t.createdAt);
    const completed = new Date(t.completedAt);
    const days = Math.ceil((completed - created) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);
  return Math.round(totalDays / completedTasks.length);
}

// =================== USERS ===================

function canDeleteUser(user) {
  return currentUser.role === "admin" && String(user.id) !== String(currentUser.id);
}

function loadUsers() {
  const users = getAllUsers();
  const listEl = document.getElementById("usersList");
  if (!listEl) return;

  if (!users.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <p>ไม่มีผู้ใช้งานในระบบ</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = users
    .map(
      (u) => `
      <div class="user-card">
        <div class="user-info-card">
          <div class="user-avatar">${u.fullName ? u.fullName.charAt(0) : "?"}</div>
          <div class="user-details-card">
            <p class="user-name-card">${u.fullName}</p>
            <p class="user-role-card">${getRoleDisplayName(u.role)} • ${
        u.username
      }</p>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          ${
            canDeleteUser(u)
              ? `<button class="btn btn-danger" style="padding:6px 12px;font-size:12px;" data-user-id="${u.id}">ลบ</button>`
              : ""
          }
        </div>
      </div>
    `
    )
    .join("");

  listEl
    .querySelectorAll("button[data-user-id]")
    .forEach((btn) => {
      const id = btn.getAttribute("data-user-id");
      btn.addEventListener("click", () => deleteUser(id, btn));
    });
}

async function deleteUser(id, btnEl) {
  if (isLoading) return;

  if (!btnEl.dataset.confirmed) {
    btnEl.dataset.confirmed = "true";
    const original = btnEl.textContent;
    btnEl.textContent = "คลิกอีกครั้งเพื่อยืนยัน";
    const originalBg = btnEl.style.background;
    btnEl.style.background = "#D32F2F";

    setTimeout(() => {
      btnEl.dataset.confirmed = "";
      btnEl.textContent = original;
      btnEl.style.background = originalBg;
    }, 3000);
    return;
  }

  isLoading = true;
  try {
    await apiDelete("user", { id, type: "user" });
    showToast("ลบผู้ใช้สำเร็จ", "success");
    await loadAllDataAndRefresh();
  } catch (err) {
    console.error(err);
    showToast("เกิดข้อผิดพลาดในการลบผู้ใช้", "error");
  } finally {
    isLoading = false;
    btnEl.dataset.confirmed = "";
  }
}

// =================== DOMContentLoaded ===================

document.addEventListener("DOMContentLoaded", () => {
  // ถ้าหน้ามี loginForm แสดงว่าอยู่หน้า login
  if (document.getElementById("loginForm")) {
    initLoginPage();
  }

  // ถ้ามี dashboard แสดงว่าอยู่หน้า index
  if (document.getElementById("dashboard")) {
    initDashboardPage();
  }
});
