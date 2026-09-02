const popup = document.querySelector('.image-popup');
const popupImage = popup.querySelector('img');
const closeButton = popup.querySelector('.image-popup-close');
const images = document.querySelectorAll('.zoom');

images.forEach(image => {
    image.addEventListener('click', () => {
        popupImage.src = image.src;
        popupImage.alt = image.alt;
        popup.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});

function closePopup() {
    popup.classList.remove('active');
    popupImage.src = '';
    document.body.style.overflow = '';
}

closeButton.addEventListener('click', closePopup);

popup.addEventListener('click', event => {
    if (event.target === popup) {
        closePopup();
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closePopup();
    }
});
