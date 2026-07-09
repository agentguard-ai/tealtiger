/* ============================================
   Hooked With Love — Main JavaScript
   ============================================ */

(function () {
    'use strict';

    // ==========================================
    // Header scroll effect
    // ==========================================
    const header = document.getElementById('siteHeader');

    function handleHeaderScroll() {
        if (window.scrollY > 20) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    handleHeaderScroll();

    // ==========================================
    // Mobile menu toggle
    // ==========================================
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mainNav = document.getElementById('mainNav');

    if (mobileMenuBtn && mainNav) {
        mobileMenuBtn.addEventListener('click', function () {
            mainNav.classList.toggle('open');
            mobileMenuBtn.classList.toggle('active');
        });

        // Close mobile menu when a nav link is clicked
        mainNav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                mainNav.classList.remove('open');
                mobileMenuBtn.classList.remove('active');
            });
        });
    }

    // ==========================================
    // Modal functionality
    // ==========================================
    const modal = document.getElementById('contactModal');
    const modalClose = document.getElementById('modalClose');
    const whatsappLink = document.getElementById('whatsappLink');
    const modalProductPreview = document.getElementById('modalProductPreview');
    const modalProductImage = document.getElementById('modalProductImage');
    const modalProductName = document.getElementById('modalProductName');
    const modalTitle = document.getElementById('modalTitle');

    function openModal(productName, price, imageSrc) {
        if (!modal) return;

        // If product info is provided, show product preview
        if (productName && modalProductPreview) {
            modalProductPreview.style.display = 'block';
            if (modalProductImage) {
                modalProductImage.src = imageSrc || '';
                modalProductImage.alt = productName;
            }
            if (modalProductName) {
                modalProductName.textContent = productName;
            }
            if (modalTitle) {
                modalTitle.textContent = 'Purchase Enquiry';
            }

            // Update WhatsApp link with product info
            if (whatsappLink) {
                var message = 'Hello Hooked With Love, I am interested in purchasing ' + productName + ' priced at ₹' + price + '.';
                whatsappLink.href = 'https://wa.me/919876543210?text=' + encodeURIComponent(message);
            }
        } else {
            // General contact modal
            if (modalProductPreview) {
                modalProductPreview.style.display = 'none';
            }
            if (modalTitle) {
                modalTitle.textContent = 'Get in Touch';
            }
            if (whatsappLink) {
                whatsappLink.href = 'https://wa.me/919876543210?text=' + encodeURIComponent('Hello Hooked With Love, I am interested in your crochet creations!');
            }
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Close button
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    // Click outside to close
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Escape key to close
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // Open contact modal buttons (general contact)
    document.querySelectorAll('[data-open-contact]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            openModal();
        });
    });

    // Purchase enquiry buttons (product-specific)
    document.querySelectorAll('.btn-enquiry').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var productName = this.getAttribute('data-product');
            var price = this.getAttribute('data-price');
            var imageSrc = this.getAttribute('data-image');
            openModal(productName, price, imageSrc);
        });
    });

    // ==========================================
    // Gallery filtering
    // ==========================================
    const filterTabs = document.querySelectorAll('.filter-tab');
    const galleryCards = document.querySelectorAll('.gallery-card');
    const breadcrumbCategorySep = document.querySelector('.breadcrumb-category-sep');
    const breadcrumbCategory = document.querySelector('.breadcrumb-category');

    const categoryNames = {
        'all': 'All',
        'flowers': 'Flowers',
        'fruits': 'Fruits',
        'hair-accessories': 'Hair Accessories',
        'lifestyle-accessories': 'Lifestyle Accessories'
    };

    function filterGallery(category) {
        // Update active tab
        filterTabs.forEach(function (tab) {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });
        var activeTab = document.querySelector('[data-category="' + category + '"]');
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
        }

        // Update breadcrumb
        if (breadcrumbCategorySep && breadcrumbCategory) {
            if (category === 'all') {
                breadcrumbCategorySep.style.display = 'none';
                breadcrumbCategory.textContent = '';
            } else {
                breadcrumbCategorySep.style.display = '';
                breadcrumbCategory.textContent = categoryNames[category] || category;
            }
        }

        // Fade out cards
        galleryCards.forEach(function (card) {
            card.classList.add('fade-out');
            card.classList.remove('fade-in');
        });

        // After fade out, show/hide and fade in
        setTimeout(function () {
            galleryCards.forEach(function (card) {
                var cardCategory = card.getAttribute('data-category');
                if (category === 'all' || cardCategory === category) {
                    card.classList.remove('hidden');
                    card.classList.remove('fade-out');
                    card.classList.add('fade-in');
                } else {
                    card.classList.add('hidden');
                    card.classList.remove('fade-out');
                    card.classList.remove('fade-in');
                }
            });
        }, 200);
    }

    // Attach filter click events
    filterTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var category = this.getAttribute('data-category');
            filterGallery(category);
        });
    });

    // ==========================================
    // Smooth scroll for anchor links
    // ==========================================
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var targetId = this.getAttribute('href');
            if (targetId === '#') return;
            var target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

})();
