let scheduled = false;
export function loadDisplayFonts() {
  if (scheduled) return;
  scheduled = true;
  // Handwriting fonts decorate the welcome/author views, never gate app CSS.
  window.setTimeout(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=ZCOOL+KuaiLe&display=swap";
    document.head.append(link);
  }, 0);
}
