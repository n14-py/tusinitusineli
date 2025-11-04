document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. CONFIGURACIÓN Y ELEMENTOS ---
    const API_URL = 'https://lfaftechapi.onrender.com/api'; // ¡Tu API!
    
    // Elementos del DOM
    const gamesGrid = document.getElementById('games-grid');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const categoriesContainer = document.getElementById('categories-container');
    const sectionTitle = document.getElementById('section-title');
    
    // Visor de juego (Pop-up)
    const gameViewer = document.getElementById('game-viewer');
    const gameIframe = document.getElementById('game-iframe');
    const viewerTitle = document.getElementById('viewer-title');
    const viewerClose = document.getElementById('viewer-close');
    const overlay = document.getElementById('overlay');
    
    // Menú
    const menuBtn = document.getElementById('menu-btn');
    const menu = document.getElementById('menu');
    
    // Paginación
    const paginationContainer = document.getElementById('pagination-container');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    // Estado de la aplicación
    let state = {
        currentPage: 1,
        currentCategory: 'all',
        currentQuery: '',
        totalPages: 1
    };

    // --- 2. FUNCIONES PRINCIPALES ---

    /**
     * Muestra el loader en la parrilla de juegos
     */
    function showLoader() {
        gamesGrid.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
            </div>
        `;
        paginationContainer.style.display = 'none';
    }

    /**
     * Llama a la API y trae los juegos
     */
    async function fetchGames() {
        showLoader();
        
        const { currentPage, currentCategory, currentQuery } = state;

        // Construye la URL de la API
        let url = `${API_URL}/juegos?pagina=${currentPage}&limite=12`;
        
        if (currentQuery) {
            url += `&query=${encodeURIComponent(currentQuery)}`;
            sectionTitle.textContent = `Resultados para "${currentQuery}"`;
        } else if (currentCategory !== 'all') {
            url += `&category=${encodeURIComponent(currentCategory)}`;
            const catEl = document.querySelector(`.category[data-category="${currentCategory}"]`);
            sectionTitle.textContent = `Juegos de ${catEl ? catEl.textContent : currentCategory}`;
        } else {
            sectionTitle.textContent = 'Nuevos Juegos';
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error de red al cargar juegos');
            
            const data = await response.json();
            displayGames(data.juegos);
            
            // Actualizar estado y controles de paginación
            state.totalPages = data.totalPaginas;
            pageInfo.textContent = `Página ${data.paginaActual} de ${data.totalPaginas}`;
            
            if (data.totalPaginas > 1) {
                paginationContainer.style.display = 'flex';
                prevPageBtn.disabled = data.paginaActual === 1;
                nextPageBtn.disabled = data.paginaActual === data.totalPaginas;
            }

        } catch (err) {
            console.error('Error al cargar juegos:', err);
            gamesGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--danger);">Error al cargar los juegos. Intenta de nuevo.</p>';
        }
    }

    /**
     * "Dibuja" los juegos en la pantalla
     */
    function displayGames(games) {
        gamesGrid.innerHTML = '';
        
        if (games.length === 0) {
            gamesGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:2rem;color:#666;">No se encontraron juegos que coincidan con tu búsqueda.</p>';
            return;
        }
        
        games.forEach(game => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            
            // Usa la descripción de la IA (¡esto es clave para SEO!)
            const description = game.description ? game.description.substring(0, 100) + '...' : `Juega ${game.title} gratis, uno de los mejores juegos de ${game.category}.`;
            
            gameCard.innerHTML = `
                <img src="${game.thumbnailUrl}" alt="${game.title}" class="game-thumbnail" onerror="this.style.backgroundColor='#eee'; this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';">
                <div class="game-info">
                    <div class="game-title">${game.title}</div>
                    <div class="game-description">${description}</div>
                    <div class="game-actions">
                        <button class="btn btn-primary btn-play" data-url="${game.embedUrl}" data-title="${game.title}">
                            <i class="fas fa-play"></i> Jugar
                        </button>
                        <a href="juego.html?slug=${game.slug}" class="btn btn-secondary" title="Más información y reseña">
                            <i class="fas fa-info-circle"></i> Info
                        </a>
                    </div>
                </div>
            `;
            
            gamesGrid.appendChild(gameCard);
        });
        
        // Añade los listeners a los nuevos botones de "Jugar"
        setupGameButtons();
    }

    /**
     * Llama a la API y trae las categorías
     */
    async function fetchCategories() {
        try {
            const response = await fetch(`${API_URL}/juegos/categories`);
            if (!response.ok) throw new Error('Error de red al cargar categorías');
            
            const categories = await response.json();
            
            categories.forEach(category => {
                if (category) { // Evitar nulos
                     const categoryEl = document.createElement('div');
                     categoryEl.className = 'category';
                     categoryEl.dataset.category = category;
                     // Capitaliza la primera letra
                     categoryEl.textContent = category.charAt(0).toUpperCase() + category.slice(1);
                     categoriesContainer.appendChild(categoryEl);
                }
            });
            
            // Añade los listeners a los nuevos botones de categoría
            setupCategoryButtons();
        } catch (err) {
            console.error('Error al cargar categorías:', err);
        }
    }

    /**
     * Añade listeners a los botones de "Jugar"
     */
    function setupGameButtons() {
        document.querySelectorAll('.btn-play').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.target.closest('button').getAttribute('data-url');
                const title = e.target.closest('button').getAttribute('data-title');
                openGameViewer(url, title);
            });
        });
    }

    /**
     * Añade listeners a los botones de "Categoría"
     */
    function setupCategoryButtons() {
        categoriesContainer.addEventListener('click', (e) => {
            const categoryEl = e.target.closest('.category');
            if (categoryEl) {
                // Actualiza el estado
                state.currentCategory = categoryEl.dataset.category;
                state.currentQuery = ''; // Resetea la búsqueda
                state.currentPage = 1;
                searchInput.value = '';
                
                // Actualiza el estilo
                document.querySelectorAll('.category').forEach(c => c.classList.remove('active'));
                categoryEl.classList.add('active');
                
                // Vuelve a cargar los juegos
                fetchGames();
            }
        });
    }

    /**
     * Abre el visor de juego
     */
    function openGameViewer(url, title) {
        viewerTitle.textContent = title;
        gameIframe.src = url; // Carga el juego
        gameViewer.style.display = 'flex';
        overlay.style.display = 'block';
    }

    /**
     * Cierra el visor de juego
     */
    function closeGameViewer() {
        gameIframe.src = ''; // ¡Importante para detener el sonido del juego!
        gameViewer.style.display = 'none';
        overlay.style.display = 'none';
    }

    /**
     * Cierra el menú
     */
    function closeMenu() {
        menu.classList.remove('active');
        overlay.style.display = 'none';
    }

    /**
     * Añade listeners al menú principal
     */
    function initMenuListeners() {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('active');
            overlay.style.display = 'block';
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && e.target !== menuBtn) {
                closeMenu();
            }
        });

        overlay.addEventListener('click', () => {
            closeGameViewer();
            closeMenu();
        });
        
        viewerClose.addEventListener('click', closeGameViewer);
    }

    /**
     * Añade listeners al buscador
     */
    function initSearchListeners() {
        const doSearch = () => {
            const query = searchInput.value.trim();
            if (query) {
                state.currentQuery = query;
                state.currentCategory = 'all'; // Resetea categoría
                state.currentPage = 1;
                
                // Quita 'active' de todas las categorías
                document.querySelectorAll('.category').forEach(c => c.classList.remove('active'));

                fetchGames();
            }
        };
        
        searchBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                doSearch();
            }
        });
    }

    /**
     * Añade listeners a la paginación
     */
    function initPaginationListeners() {
        prevPageBtn.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                fetchGames();
            }
        });
        
        nextPageBtn.addEventListener('click', () => {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                fetchGames();
            }
        });
    }

    /**
     * Registra el Service Worker (de tu sw.js)
     */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('Service Worker registrado con éxito.'))
                    .catch(err => console.log('Error al registrar Service Worker:', err));
            });
        }
    }

    // --- 3. INICIO DE LA APLICACIÓN ---
    
    initMenuListeners();
    initSearchListeners();
    initPaginationListeners();
    registerServiceWorker();

    // Carga inicial
    fetchGames(); // Carga los juegos populares
    fetchCategories(); // Carga las categorías

});