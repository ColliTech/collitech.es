
const menuWrap = document.getElementById("menuWrap");
const menuButton = document.getElementById("menuButton");

menuButton.addEventListener("click", () => {
  const open = menuWrap.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", open ? "true" : "false");
});

document.addEventListener("click", (event) => {
  if (!menuWrap.contains(event.target)) {
    menuWrap.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  }
});
