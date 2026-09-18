/* Small Danish/accessibility adapter for unmodified webexercises 1.2.0 assets. */
window.addEventListener("load", () => {
  const fields = document.querySelectorAll(".webex-solveme, .webex-select, .webex-radiogroup");
  const refresh = () => {
    document.querySelectorAll(".webex-check").forEach(section => {
      const button = section.querySelector(":scope > .webex-check-button");
      if (button) {
        button.textContent = section.classList.contains("unchecked") ? "Tjek svar" : "Skjul feedback";
        button.setAttribute("aria-expanded", String(!section.classList.contains("unchecked")));
      }
      const total = section.querySelector(":scope > .webex-total_correct");
      if (total) {
        total.textContent = `${section.querySelectorAll('.webex-correct').length} af ${section.querySelectorAll('.webex-solveme, .webex-select, .webex-radiogroup').length} rigtige`;
        total.setAttribute("role", "status");
      }
    });
    document.querySelectorAll(".webex-solution > button").forEach(button => {
      button.setAttribute("aria-expanded", String(button.parentElement.classList.contains("open")));
    });
    fields.forEach(field => {
      const selected = field.matches(".webex-radiogroup") ? field.querySelector("input:checked")?.parentElement : field;
      const correct = selected?.classList.contains("webex-correct");
      const incorrect = selected?.classList.contains("webex-incorrect");
      const feedback = document.getElementById(field.dataset.feedbackId);
      if (feedback) feedback.textContent = correct ? "Rigtigt" : incorrect ? "Prøv igen" : "";
    });
  };
  fields.forEach((field, i) => {
    const question = field.closest("p") || field.closest(".exercise, .webex-box");
    if (!field.matches(".webex-radiogroup")) field.setAttribute("aria-label", question?.textContent.trim() || `Svar ${i + 1}`);
    const feedback = document.createElement("span");
    feedback.className = "webex-feedback";
    feedback.id = `webex-feedback-${i}`;
    feedback.setAttribute("aria-live", "polite");
    field.dataset.feedbackId = feedback.id;
    field.setAttribute("aria-describedby", feedback.id);
    field.insertAdjacentElement("afterend", feedback);
  });
  // Upstream 1.2.0 can leave both feedback classes on tolerance/regex matches,
  // and regards blank numeric inputs as zero. Normalise these two cases.
  const normalise = field => {
    if (!field.matches(".webex-solveme")) return;
    if (!field.value.trim()) field.classList.remove("webex-correct", "webex-incorrect");
    else if (field.classList.contains("webex-correct")) field.classList.remove("webex-incorrect");
  };
  document.addEventListener("input", event => {
    if (event.target.matches(".webex-solveme")) {
      solveme_func.call(event.target, event);
      normalise(event.target);
      refresh();
    }
  });
  ["keyup", "change"].forEach(type => document.addEventListener(type, event => {
    if (event.target instanceof Element) normalise(event.target);
    refresh();
  }));
  document.addEventListener("click", refresh);
  refresh();
});
