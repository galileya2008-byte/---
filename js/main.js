(function () {
  "use strict";

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector("#site-nav");

  if (toggle && nav) {
    function isOpen() {
      return toggle.getAttribute("aria-expanded") === "true";
    }

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Закрыть" : "Меню";
      nav.classList.toggle("is-open", open);
    }

    toggle.addEventListener("click", function () {
      var open = !isOpen();
      setOpen(open);
      if (open) {
        var first = nav.querySelector("a");
        if (first) first.focus();
      }
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", function (event) {
      if (!isOpen()) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });
  }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = document.querySelectorAll(".reveal");

  if (!reveals.length) return;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(reveals, function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  Array.prototype.forEach.call(reveals, function (el) {
    observer.observe(el);
  });
})();
