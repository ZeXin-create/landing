/* ==========================================================================
   AI 发酵平台 · 极简引流落地页 —— 共享脚本
   纯静态，无构建。所有需要替换的配置都在这一个对象里。
   ========================================================================== */

/* --------------------------------------------------------------------------
 * 【上线前必改】联系方式与品牌配置
 * ------------------------------------------------------------------------ */
const CONTACT = {
  // 展示用电话号（可带短横线）
  phoneDisplay: "195-3377-7849",
  // 拨号链接（去掉短横线/空格）
  phoneHref: "tel:19533777849",
  // 品牌名（用于页面标题、导航、页脚）
  brand: "AI 发酵平台",
  // 留资接口地址。留空 = 纯前端提示成功，不真正收集留资。
  // 需要真正收到留资时，填一个接口（如 Formspree、自建 API），
  // 表单会以 multipart/form-data POST name/phone/company/need 四个字段（website 为蜜罐字段，非人工无需理会）。
  leadEndpoint: "",
  // 是否开放在线留资表单。false = 仅电话联系（表单字段保留但禁用）。
  leadEnabled: false,
};

/* --------------------------------------------------------------------------
 * 注入品牌名与电话
 * ------------------------------------------------------------------------ */
function hydrate() {
  document.querySelectorAll(".js-brand").forEach((el) => {
    el.textContent = CONTACT.brand;
  });
  document.querySelectorAll(".js-phone").forEach((el) => {
    el.textContent = CONTACT.phoneDisplay;
    el.setAttribute("href", CONTACT.phoneHref);
  });
}

/* --------------------------------------------------------------------------
 * 联系我弹窗（由 JS 统一构建，避免多页面重复）
 * ------------------------------------------------------------------------ */
function buildModal() {
  const leadOn = CONTACT.leadEnabled;
  const dis = leadOn ? "" : " disabled";
  const modalSub = leadOn
    ? "留下需求，我们会在 1 个工作日内电话联系您。"
    : "在线留资暂未开放，目前仅支持电话联系。";
  const disabledNote = leadOn
    ? ""
    : `<div class="form-disabled-note">
        目前仅支持电话联系，请直接拨打
        <a class="js-phone" href="${CONTACT.phoneHref}">${CONTACT.phoneDisplay}</a>。
      </div>`;

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "contactModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "contactTitle");
  modal.innerHTML = `
    <div class="modal">
      <button class="modal-close" type="button" aria-label="关闭">&times;</button>
      <h2 id="contactTitle">联系我们</h2>
      <p class="modal-sub">${modalSub}</p>

      <div class="phone-card">
        <p class="phone-label">电话咨询（可直接拨打）</p>
        <a class="phone-number js-phone" href="${CONTACT.phoneHref}">${CONTACT.phoneDisplay}</a>
        <button class="btn btn-ghost btn-copy" type="button" data-copy-phone>复制号码</button>
      </div>

      ${disabledNote}

      <form class="lead-form" id="leadForm" novalidate>
        <label>姓名 *
          <input name="name" type="text" placeholder="怎么称呼您" autocomplete="name" required${dis} />
        </label>
        <label>手机号 *
          <input name="phone" type="tel" placeholder="用于接收演示 / 回电" autocomplete="tel" inputmode="numeric" maxlength="11" required${dis} />
        </label>
        <label>公司
          <input name="company" type="text" placeholder="公司 / 单位名称" autocomplete="organization"${dis} />
        </label>
        <label>需求
          <textarea name="need" rows="3" placeholder="想预测什么 / 想了解数字孪生哪一块"${dis}></textarea>
        </label>
        <input class="hp-field" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <p class="form-error" id="formError" role="alert"></p>
        <button class="btn btn-primary btn-block" type="submit"${dis}>${leadOn ? "提交留资" : "暂未开放"}</button>
      </form>

      <div class="form-success" id="formSuccess">
        已收到，感谢信任！我们会尽快电话联系您。<br />
        如需立即沟通，请拨打
        <a class="js-phone" href="${CONTACT.phoneHref}">${CONTACT.phoneDisplay}</a>。
      </div>

      ${leadOn ? '<p class="modal-legal">提交即表示您同意我们通过电话与您联系。</p>' : ""}
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

/* --------------------------------------------------------------------------
 * 弹窗开关
 * ------------------------------------------------------------------------ */
function setupModal(modal) {
  const closeBtn = modal.querySelector(".modal-close");
  let lastFocused = null;

  const open = () => {
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  };
  const close = () => {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  };

  document.querySelectorAll(".js-open-contact").forEach((btn) => {
    btn.addEventListener("click", open);
  });
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) close();
  });

  return { open, close };
}

/* --------------------------------------------------------------------------
 * 复制电话
 * ------------------------------------------------------------------------ */
function setupCopy(modal) {
  const btn = modal.querySelector("[data-copy-phone]");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.phoneDisplay.replace(/[^0-9+]/g, ""));
      btn.textContent = "已复制";
      setTimeout(() => (btn.textContent = "复制号码"), 1600);
    } catch {
      /* 剪贴板不可用时，选中号码让用户手动复制 */
      const range = document.createRange();
      const num = modal.querySelector(".phone-number");
      range.selectNodeContents(num);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
}

/* --------------------------------------------------------------------------
 * 留资表单提交
 * ------------------------------------------------------------------------ */
function setupForm(modal) {
  const form = modal.querySelector("#leadForm");
  const errorEl = modal.querySelector("#formError");
  const successEl = modal.querySelector("#formSuccess");

  let submitting = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!CONTACT.leadEnabled) return; // 留资未开放时仅电话联系
    errorEl.textContent = "";
    if (submitting) return; // 防重复提交

    const data = new FormData(form);

    /* 蜜罐：正常用户看不到，机器人填了就当成功静默丢弃 */
    if ((data.get("website") || "").trim()) {
      form.style.display = "none";
      successEl.classList.add("is-visible");
      successEl.querySelector(".js-phone").textContent = CONTACT.phoneDisplay;
      return;
    }

    const name = (data.get("name") || "").trim();
    const phone = (data.get("phone") || "").trim();
    if (!name) {
      errorEl.textContent = "请填写姓名。";
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      errorEl.textContent = "请填写正确的 11 位手机号。";
      return;
    }

    submitting = true;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "提交中…";

    try {
      if (CONTACT.leadEndpoint) {
        const res = await fetch(CONTACT.leadEndpoint, {
          method: "POST",
          body: data,
        });
        if (!res.ok) throw new Error("submit failed");
      }
      form.style.display = "none";
      successEl.classList.add("is-visible");
      successEl.querySelector(".js-phone").textContent = CONTACT.phoneDisplay;
    } catch {
      errorEl.textContent = "提交失败，请直接拨打上方电话与我们联系。";
      submitBtn.disabled = false;
      submitBtn.textContent = "提交留资";
    } finally {
      submitting = false;
    }
  });
}

/* --------------------------------------------------------------------------
 * 实时时钟（图表 HUD 用，增强“在线数据”感）
 * ------------------------------------------------------------------------ */
function setupClock() {
  const nodes = document.querySelectorAll(".js-clock");
  if (!nodes.length) return;
  const tick = () => {
    const now = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const text = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ` +
      `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    nodes.forEach((el) => (el.textContent = text));
  };
  tick();
  setInterval(tick, 1000);
}

/* --------------------------------------------------------------------------
 * 深浅色主题切换
 * ------------------------------------------------------------------------ */
function setupTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme") || "dark";
  root.setAttribute("data-theme", saved);
  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  });
}

/* --------------------------------------------------------------------------
 * 移动端导航（汉堡菜单）
 * ------------------------------------------------------------------------ */
function setupNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("siteNav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
  };

  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("is-open") && !toggle.contains(e.target) && !nav.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) setOpen(false);
  });
}

/* --------------------------------------------------------------------------
 * 炫酷动效：鼠标光斑 / 视差 / 卡片 3D / 滚动入场 / 实时遥测 / 打字机
 * ------------------------------------------------------------------------ */

/* 鼠标光斑跟随（仅精细指针设备；柔和青色光晕跟在鼠标后面） */
function setupCursorGlow() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  glow.setAttribute("aria-hidden", "true");
  glow.style.transform = "translate3d(-999px, -999px, 0)";
  document.body.appendChild(glow);

  document.addEventListener("pointermove", (e) => {
    glow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  }, { passive: true });
}

/* Hero 可视化卡片随鼠标轻微 3D 视差（指针离开自动回正；无指针时零开销） */
function setupParallax() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const hero = document.querySelector(".hero");
  const visual = document.querySelector(".hero-visual");
  if (!hero || !visual) return;

  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;

  function frame() {
    cx += (tx - cx) * 0.1;
    cy += (ty - cy) * 0.1;
    visual.style.transform = `perspective(1200px) rotateX(${(-cy * 3).toFixed(2)}deg) rotateY(${(cx * 3).toFixed(2)}deg)`;
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
      visual.style.transform = "";
    }
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - 0.5;
    ty = (e.clientY - r.top) / r.height - 0.5;
    kick();
  });
  hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; kick(); });
}

/* 能力卡片 3D 倾斜（鼠标进入随位置旋转，离开平滑回正） */
function setupCardTilt() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const MAX = 6;
  const fast = "transform 0.08s ease-out, border-color 0.2s ease, box-shadow 0.2s ease";
  const slow = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease, box-shadow 0.2s ease";

  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("pointerenter", () => { card.style.transition = fast; });
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `translateY(-4px) perspective(900px) rotateX(${(-py * MAX).toFixed(2)}deg) rotateY(${(px * MAX).toFixed(2)}deg)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transition = slow;
      card.style.transform = "";
    });
  });
}

/* 滚动入场动画（IntersectionObserver，同组元素轻微错峰） */
function setupReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  const groups = [
    Array.from(document.querySelectorAll(".section-head")),
    Array.from(document.querySelectorAll(".cards .card")),
    Array.from(document.querySelectorAll(".steps li")),
    Array.from(document.querySelectorAll(".product-shot")),
    Array.from(document.querySelectorAll(".cta-panel")),
  ];
  const targets = [];
  groups.forEach((group) => {
    group.forEach((el, i) => {
      el.classList.add("reveal");
      el.style.setProperty("--reveal-delay", i * 90 + "ms");
      targets.push(el);
    });
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  targets.forEach((el) => io.observe(el));
}

/* 实时遥测：把 hero 读条 chip 替换为 pH / 溶氧 / 菌浓等，每秒抖动一次 */
const TELEMETRY = [
  { name: "pH",      value: 6.82, min: 6.70, max: 6.95, decimals: 2, unit: "" },
  { name: "溶氧",    value: 32.5, min: 28.0, max: 37.0, decimals: 1, unit: "%" },
  { name: "菌浓 OD", value: 12.40, min: 11.5, max: 13.5, decimals: 2, unit: "" },
  { name: "葡萄糖",  value: 8.7,  min: 7.2,  max: 10.2, decimals: 1, unit: "g/L" },
  { name: "温度",    value: 37.0, min: 36.5, max: 37.5, decimals: 1, unit: "℃" },
];

function setupTelemetry() {
  const readout = document.querySelector(".readout");
  if (!readout) return;

  readout.innerHTML = TELEMETRY.map((m) =>
    `<span class="chip"><span class="t-name">${m.name}</span> <b class="t-val">${m.value.toFixed(m.decimals)}</b><span class="t-unit">${m.unit}</span></span>`
  ).join("");

  const vals = readout.querySelectorAll(".t-val");
  setInterval(() => {
    TELEMETRY.forEach((m) => {
      m.value += (Math.random() - 0.5) * (m.max - m.min) * 0.12;
      if (m.value < m.min) m.value = m.min;
      if (m.value > m.max) m.value = m.max;
    });
    vals.forEach((el, i) => {
      el.textContent = TELEMETRY[i].value.toFixed(TELEMETRY[i].decimals);
    });
  }, 1000);
}

/* 标题打字机：主标题逐字浮现 + 闪烁光标（仅首屏播一次） */
function setupTypewriter() {
  const h1 = document.querySelector(".hero h1");
  if (!h1) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const segs = [];
  h1.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) segs.push({ t: n.textContent, g: false });
    else if (n.nodeType === Node.ELEMENT_NODE && n.classList.contains("grad")) segs.push({ t: n.textContent, g: true });
  });
  const total = segs.reduce((s, x) => s + x.t.length, 0);
  if (!total) return;

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const full = () => segs.map((s) => (s.g ? `<span class="grad">${esc(s.t)}</span>` : esc(s.t))).join("");

  h1.style.minHeight = h1.offsetHeight + "px";

  let i = 0;
  const render = () => {
    let out = "", left = i;
    for (const seg of segs) {
      if (left <= 0) break;
      const part = seg.t.slice(0, left);
      out += seg.g ? `<span class="grad">${esc(part)}</span>` : esc(part);
      left -= seg.t.length;
    }
    h1.innerHTML = out + '<span class="caret" aria-hidden="true"></span>';
  };

  const timer = setInterval(() => {
    i += 1;
    if (i >= total) {
      clearInterval(timer);
      h1.innerHTML = full();
      h1.style.minHeight = "";
    } else {
      render();
    }
  }, 42);

  render();
}

/* --------------------------------------------------------------------------
 * 入口
 * ------------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  hydrate();
  setupClock();
  setupTheme();
  setupNav();

  /* 炫酷动效 */
  setupCursorGlow();
  setupParallax();
  setupCardTilt();
  setupReveal();
  setupTelemetry();
  setupTypewriter();

  const modal = buildModal();
  const { close } = setupModal(modal);
  setupCopy(modal);
  setupForm(modal);

  /* 表单提交成功后，若再打开弹窗，恢复到表单状态 */
  modal.addEventListener("transitionend", () => {
    if (!modal.classList.contains("is-open")) return;
    const form = modal.querySelector("#leadForm");
    const success = modal.querySelector("#formSuccess");
    if (form && success) {
      form.style.display = "";
      success.classList.remove("is-visible");
      form.reset();
    }
  });
});
