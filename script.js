const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function currentTheme() {
    return root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
}

function updateThemeToggle() {
    if (!themeToggle) return;
    themeToggle.setAttribute('aria-checked', String(currentTheme() === 'dark'));
}

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let themeTimer;

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        if (!motionQuery.matches) {
            root.classList.add('theme-anim');
            clearTimeout(themeTimer);
            themeTimer = setTimeout(() => root.classList.remove('theme-anim'), 500);
        }
        root.dataset.theme = next;
        try {
            localStorage.setItem('theme', next);
        } catch (e) {}
        updateThemeToggle();
    });
}

darkQuery.addEventListener('change', updateThemeToggle);
updateThemeToggle();

/* image zoom: the thumbnail grows into the full-size image and shrinks back */

const popup = document.querySelector('.image-popup');
const popupImage = popup && popup.querySelector('img');
const closeButton = popup && popup.querySelector('.image-popup-close');
let source = null;
let zoomAnim = null;
let zoomId = 0;
let closeTimer = null;
let opening = false;
let closing = false;

function resetPopup() {
    zoomId++;
    clearTimeout(closeTimer);
    if (zoomAnim) {
        zoomAnim.cancel();
        zoomAnim = null;
    }
    popup.classList.remove('active', 'visible', 'shown');
    popupImage.removeAttribute('src');
    document.body.style.overflow = '';
    if (source) {
        source.style.visibility = '';
        source.focus({ preventScroll: true });
        source = null;
    }
    opening = false;
    closing = false;
}

async function openPopup(image) {
    if (!popup || opening || popup.classList.contains('active')) return;
    const id = ++zoomId;
    opening = true;
    source = image;
    popupImage.src = image.currentSrc || image.src;
    popupImage.alt = image.alt;
    popup.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        await Promise.race([popupImage.decode(), new Promise(resolve => setTimeout(resolve, 300))]);
    } catch (e) {}
    if (id !== zoomId) return;

    const from = image.getBoundingClientRect();
    const to = popupImage.getBoundingClientRect();
    popup.classList.add('visible');
    void popup.offsetWidth;
    popup.classList.add('shown');
    closeButton.focus({ preventScroll: true });
    image.style.visibility = 'hidden';
    opening = false;

    if (!motionQuery.matches && from.width && to.width) {
        const sx = from.width / to.width;
        const sy = from.height / to.height;
        const radius = parseFloat(getComputedStyle(image).borderTopLeftRadius) || 0;
        const endRadius = parseFloat(getComputedStyle(popupImage).borderTopLeftRadius) || 0;
        zoomAnim = popupImage.animate([
            {
                transformOrigin: '0 0',
                transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`,
                borderRadius: `${radius / sx}px / ${radius / sy}px`
            },
            {
                transformOrigin: '0 0',
                transform: 'none',
                borderRadius: `${endRadius}px`
            }
        ], { duration: 450, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' });
    }
}

function closePopup(immediate) {
    if (!popup || !popup.classList.contains('active') || closing) return;
    if (immediate === true || opening || motionQuery.matches) {
        resetPopup();
        return;
    }
    closing = true;
    popup.classList.remove('shown');
    if (zoomAnim) {
        zoomAnim.onfinish = resetPopup;
        zoomAnim.playbackRate = 1.25;
        zoomAnim.reverse();
    } else {
        closeTimer = setTimeout(resetPopup, 400);
    }
}

window.addEventListener('resize', () => {
    if (zoomAnim) {
        zoomAnim.cancel();
        zoomAnim = null;
    }
});

document.querySelectorAll('.zoom').forEach(image => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
});

document.addEventListener('click', event => {
    const image = event.target.closest('.zoom');
    if (image) openPopup(image);
});

if (popup) {
    closeButton.addEventListener('click', () => closePopup());

    popup.addEventListener('click', event => {
        if (event.target === popup) {
            closePopup();
        }
    });
}

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closePopup();
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target.classList && event.target.classList.contains('zoom')) {
        event.preventDefault();
        openPopup(event.target);
    }
});

/* scroll reveal: every part of a block appears when it is well inside the screen (a quarter up from the bottom edge) */

let revealPending = [];
let revealTicking = false;

function revealCheck() {
    revealTicking = false;
    const line = window.innerHeight * 0.75;
    // at the very end of the page the last parts can never reach the line, so they appear as soon as they are visible
    const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    let i = 0;
    revealPending = revealPending.filter(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top >= line && !(atEnd && rect.top < window.innerHeight)) return true;
        if (rect.bottom < 0) {
            el.classList.add('is-instant');
            el.parentElement.classList.add('is-instant');
        } else {
            el.style.setProperty('--d', (i++ * 110) + 'ms');
        }
        el.classList.add('is-visible');
        el.parentElement.classList.add('is-started');
        return false;
    });
}

function requestRevealCheck() {
    if (revealTicking || !revealPending.length) return;
    revealTicking = true;
    requestAnimationFrame(revealCheck);
}

function initReveal() {
    revealPending = [];
    const blocks = document.querySelectorAll('main:not([hidden]) .block');
    blocks.forEach(block => {
        block.classList.remove('is-started', 'is-instant');
        Array.from(block.children).forEach(child => {
            child.classList.remove('is-visible', 'is-instant');
            child.style.removeProperty('--d');
        });
    });
    if (!blocks.length || !document.documentElement.classList.contains('reveal-ready')) return;

    // everything that fits on the first screen is shown at once, down to its bottom edge
    // (the quarter line is only for parts that arrive while the page is scrolled)
    const screenBottom = window.innerHeight;
    blocks.forEach(block => {
        if (block.getBoundingClientRect().top < screenBottom) {
            block.classList.add('is-started', 'is-instant');
        }
        Array.from(block.children).forEach(child => {
            if (child.getBoundingClientRect().top < screenBottom) {
                child.classList.add('is-visible', 'is-instant');
            } else {
                revealPending.push(child);
            }
        });
    });
}

window.addEventListener('scroll', requestRevealCheck, { passive: true });
window.addEventListener('resize', requestRevealCheck);
initReveal();
