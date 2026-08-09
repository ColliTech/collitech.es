
const SUPABASE_URL = "https://urdxxxvvzrjzeiigcczo.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_rifoXYsRebVgiGiMvcwjOg_olMs1zXV";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedRating = 0;

const starButtons = document.querySelectorAll("#stars button");
const nameInput = document.getElementById("review-name");
const messageInput = document.getElementById("review-message");
const submitButton = document.getElementById("submit-review");
const statusMessage = document.getElementById("review-status");
const reviewsList = document.getElementById("reviews-list");
const averageRating = document.getElementById("average-rating");
const reviewsCount = document.getElementById("reviews-count");

starButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectedRating = Number(button.dataset.rating);
    starButtons.forEach(star => {
      star.classList.toggle("selected", Number(star.dataset.rating) <= selectedRating);
    });
  });
});

function escapeHTML(text) {
  return String(text)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

async function loadReviews() {
  const { data, error } = await supabaseClient
    .from("reviews")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    reviewsList.innerHTML = '<div class="review-card"><div class="review-text">No se han podido cargar las reseñas.</div></div>';
    return;
  }

  const total = data.length;
  reviewsCount.textContent = total;

  if (!total) {
    averageRating.textContent = "—";
    reviewsList.innerHTML = '<div class="review-card"><div class="review-text">Todavía no hay reseñas publicadas. ¡Sé el primero!</div></div>';
    return;
  }

  const average = data.reduce((sum, review) => sum + Number(review.rating), 0) / total;
  averageRating.textContent = average.toFixed(1);

  reviewsList.innerHTML = data.map(review => {
    const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    const date = new Date(review.created_at).toLocaleDateString("es-ES", {
      day:"numeric", month:"long", year:"numeric"
    });
    return `
      <article class="review-card">
        <div class="review-head">
          <div class="review-name">${escapeHTML(review.name)}</div>
          <div class="review-date">${date}</div>
        </div>
        <div class="review-stars">${stars}</div>
        <div class="review-text">${escapeHTML(review.message)}</div>
      </article>
    `;
  }).join("");
}

submitButton.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const message = messageInput.value.trim();

  if (!selectedRating) {
    statusMessage.textContent = "Selecciona una valoración de 1 a 5 estrellas.";
    return;
  }
  if (!name) {
    statusMessage.textContent = "Escribe tu nombre.";
    nameInput.focus();
    return;
  }
  if (!message) {
    statusMessage.textContent = "Escribe tu opinión.";
    messageInput.focus();
    return;
  }

  submitButton.disabled = true;
  statusMessage.textContent = "Enviando reseña...";

  const { error } = await supabaseClient.from("reviews").insert([{
    name, rating:selectedRating, message
  }]);

  if (error) {
    console.error(error);
    statusMessage.textContent = "No se ha podido enviar la reseña. Inténtalo de nuevo.";
    submitButton.disabled = false;
    return;
  }

  nameInput.value = "";
  messageInput.value = "";
  selectedRating = 0;
  starButtons.forEach(star => star.classList.remove("selected"));

  statusMessage.textContent = "¡Gracias! Tu reseña queda pendiente de revisión.";
  submitButton.disabled = false;
  await loadReviews();
});

loadReviews();
