document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. CONFIGURACIÓN Y VARIABLES GLOBALES ---
    const API_URL = 'https://lfaftechapi-7nrb.onrender.com/api'; 
    const isGamePage = window.location.pathname.includes('juego.html');
    
    // Elementos Globales de UI
    const menuBtn = document.getElementById('menu-btn');
    const menu = document.getElementById('menu');
    const overlay = document.getElementById('overlay');

    // Estado de la aplicación
    let state = {
        currentPage: 1,
        currentCategory: 'all',
        currentQuery: '',
        totalPages: 1,
        adTimer: null
    };

    // --- 2. INICIALIZACIÓN ---
    
    initGlobalListeners(); // Menú hamburguesa, etc.

    if (isGamePage) {
        initGamePage(); // Lógica específica para la página de juego
    } else {
        // Verificamos si existe el grid para saber si estamos en Home
        if (document.getElementById('games-grid')) {
            initHomePage(); 
        }
    }

    // --- 3. LÓGICA DE LA PÁGINA DE INICIO (HOME) ---

    function initHomePage() {
        // Elementos
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        const prevPageBtn = document.getElementById('prev-page');
        const nextPageBtn = document.getElementById('next-page');

        // Carga inicial
        fetchCategories();
        fetchGames();

        // Buscador
        const handleSearch = () => {
            const query = searchInput.value.trim();
            if (query !== state.currentQuery) {
                state.currentQuery = query;
                state.currentPage = 1;
                state.currentCategory = 'all'; 
                updateCategoryActiveState('all');
                fetchGames();
            }
        };

        searchBtn.addEventListener('click', handleSearch);
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleSearch();
        });

        // Paginación
        prevPageBtn.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                fetchGames();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        nextPageBtn.addEventListener('click', () => {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                fetchGames();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    async function fetchGames() {
        const grid = document.getElementById('games-grid');
        const pagination = document.getElementById('pagination-container');
        const title = document.getElementById('section-title');
        
        // Loader
        grid.innerHTML = '<div class="loading-spinner"></div>';
        pagination.style.display = 'none';

        try {
            let url = `${API_URL}/juegos?pagina=${state.currentPage}&limite=24`; // Traemos 24 por página
            
            // Filtros
            if (state.currentQuery) {
                url += `&query=${encodeURIComponent(state.currentQuery)}`;
                if(title) title.textContent = `Resultados para "${state.currentQuery}"`;
            } else if (state.currentCategory !== 'all') {
                url += `&category=${encodeURIComponent(state.currentCategory)}`;
                if(title) title.textContent = `Juegos de ${capitalize(state.currentCategory)}`;
            } else {
                if(title) title.textContent = 'Juegos Destacados';
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error('Error en API');
            
            const data = await response.json();
            
            // Renderizado
            renderGamesGrid(data.juegos, 'games-grid');
            updatePagination(data);

        } catch (error) {
            console.error(error);
            grid.innerHTML = `<p style="text-align:center; width:100%; padding:20px;">Error al cargar juegos.</p>`;
        }
    }

    async function fetchCategories() {
        const container = document.getElementById('categories-container');
        if(!container) return;

        try {
            const res = await fetch(`${API_URL}/juegos/categories`);
            const categories = await res.json();
            
            // Guardar botón "Todo"
            const allBtn = container.querySelector('[data-category="all"]');
            container.innerHTML = '';
            if(allBtn) {
                container.appendChild(allBtn);
                allBtn.addEventListener('click', () => {
                    state.currentCategory = 'all';
                    state.currentQuery = '';
                    state.currentPage = 1;
                    document.getElementById('search-input').value = '';
                    updateCategoryActiveState('all');
                    fetchGames();
                });
            }
            
            categories.forEach(cat => {
                if(cat) {
                    const btn = document.createElement('button');
                    btn.className = 'category';
                    btn.textContent = capitalize(cat);
                    btn.dataset.category = cat;
                    
                    btn.addEventListener('click', () => {
                        state.currentCategory = cat;
                        state.currentQuery = ''; 
                        state.currentPage = 1;
                        document.getElementById('search-input').value = '';
                        updateCategoryActiveState(cat);
                        fetchGames();
                    });
                    
                    container.appendChild(btn);
                }
            });
        } catch (e) { console.error('Error categorías', e); }
    }

    // --- 4. LÓGICA DE LA PÁGINA DE JUEGO (GAME PAGE) ---

    async function initGamePage() {
        const params = new URLSearchParams(window.location.search);
        const gameId = params.get('id');
        const gameSlug = params.get('slug');
        
        // Si no hay ID ni slug, volver al inicio
        if (!gameId && !gameSlug) {
            window.location.href = 'index.html';
            return;
        }

        try {
            // Estrategia: Pedimos muchos juegos (35) para tener suficientes para:
            // 1. Encontrar el juego actual (si no tenemos ID directo)
            // 2. Llenar la sidebar (5 juegos)
            // 3. Llenar el fondo (20 juegos)
            const res = await fetch(`${API_URL}/juegos?limite=35`); 
            const data = await res.json();
            const allGames = data.juegos;

            let targetGame = null;

            // 1. Buscar el juego objetivo
            if (gameId) {
                targetGame = allGames.find(g => g._id === gameId);
            }
            
            // Si no estaba en la lista inicial, buscarlo específicamente por API
            if (!targetGame && gameSlug) {
                // Intento de búsqueda por slug/nombre
                const searchRes = await fetch(`${API_URL}/juegos?query=${gameSlug.replace(/-/g, ' ')}`);
                const searchData = await searchRes.json();
                if(searchData.juegos.length > 0) targetGame = searchData.juegos[0];
            }

            if (targetGame) {
                // A. Renderizar el juego principal
                renderGamePlayer(targetGame);
                
                // B. Filtrar juegos para Sidebar y Fondo (excluyendo el actual)
                const otherGames = allGames.filter(g => g._id !== targetGame._id);
                
                // Sidebar: Primeros 5
                const sidebarGames = otherGames.slice(0, 5);
                renderSidebar(sidebarGames);

                // Fondo: Siguientes 20 (del 5 al 25)
                const bottomGames = otherGames.slice(5, 25);
                renderGamesGrid(bottomGames, 'bottom-games-grid'); // Reusamos la función de grid

                // C. Iniciar sistema de anuncios
                initAdSystem(); 

            } else {
                document.querySelector('.game-info-modern').innerHTML = '<p>Lo sentimos, no pudimos encontrar este juego.</p>';
            }

        } catch (e) {
            console.error('Error cargando página de juego:', e);
        }
    }

    function renderGamePlayer(game) {
        // Título de la pestaña
        document.title = `Jugar ${game.title} Gratis - TusiniTusineli`;
        
        // Textos
        document.getElementById('game-title-display').textContent = game.title;
        
        const desc = game.description || `¡Juega a ${game.title} ahora! Es uno de nuestros mejores juegos de ${game.category || 'arcade'}. Disfruta de horas de diversión sin descargas.`;
        document.getElementById('game-desc-display').textContent = desc;
        
        // Iframe
        const iframeWrapper = document.getElementById('iframe-wrapper');
        iframeWrapper.innerHTML = `
            <iframe src="${game.embedUrl}" class="game-iframe" allowfullscreen allow="autoplay; fullscreen; gamepad; geolocation; microphone; camera; midi"></iframe>
        `;

        // Etiquetas (Categoría)
        const tagsContainer = document.getElementById('game-tags');
        if (game.category) {
            tagsContainer.innerHTML = `<span class="category" style="font-size:12px; padding:5px 15px; background:#f1f2f6; color:#333; cursor:default;">${capitalize(game.category)}</span>`;
        }
    }

    function renderSidebar(games) {
        const container = document.getElementById('recommended-games');
        if(!container) return;
        
        container.innerHTML = '';
        games.forEach(game => {
            const link = document.createElement('a');
            link.href = `juego.html?slug=${game.slug || createSlug(game.title)}&id=${game._id}`;
            link.className = 'mini-game-card';
            
            link.innerHTML = `
                <img src="${game.thumbnailUrl}" class="mini-thumbnail" alt="${game.title}" onerror="this.src='https://via.placeholder.com/90x60'">
                <div class="mini-info">
                    <div class="mini-title">${game.title}</div>
                    <div class="mini-category" style="font-size:11px; color:#e84393;">Jugar ahora</div>
                </div>
            `;
            container.appendChild(link);
        });
    }

    // --- 5. SISTEMA DE ANUNCIOS (ADS) ---
    
    function initAdSystem() {
        console.log('Ads system loaded');
        // Intervalo de 5 minutos (300000 ms)
        const AD_INTERVAL = 5 * 60 * 1000; 
        
        // Iniciar timer
        state.adTimer = setInterval(() => {
            showInterstitialAd();
        }, AD_INTERVAL);
    }

    function showInterstitialAd() {
        // Verificar si ya existe el overlay
        let adOverlay = document.getElementById('ad-overlay');
        
        if (!adOverlay) {
            adOverlay = document.createElement('div');
            adOverlay.id = 'ad-overlay';
            adOverlay.className = 'ad-overlay-system';
            document.body.appendChild(adOverlay);
        }

        // Renderizar contenido del anuncio
        adOverlay.innerHTML = `
            <div class="ad-content-box">
                <div class="ad-timer">Publicidad</div>
                
                <div style="background:#f0f0f0; min-height:250px; margin-bottom:20px; display:flex; align-items:center; justify-content:center; border-radius:8px;">
                     <ins class="adsbygoogle"
                         style="display:block; width:300px; height:250px"
                         data-ad-client="ca-pub-5461370198299696"
                         data-ad-slot="TU-SLOT-INTERSTITIAL" 
                         data-full-width-responsive="false"></ins>
                </div>

                <p id="skip-countdown" style="margin-bottom:10px; color:#666; font-size:14px;">
                    Puedes saltar en <span id="skip-seconds" style="font-weight:bold; color:#e84393;">5</span>s
                </p>
                
                <button id="ad-skip-btn" class="ad-skip-btn">
                    Saltar Publicidad <i class="fas fa-forward"></i>
                </button>
            </div>
        `;

        // Mostrar
        adOverlay.style.display = 'flex';
        
        // Refrescar AdSense
        try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e){}

        // Lógica del contador (5 segundos)
        let secondsLeft = 5;
        const skipBtn = document.getElementById('ad-skip-btn');
        const countSpan = document.getElementById('skip-seconds');
        const countText = document.getElementById('skip-countdown');

        const interval = setInterval(() => {
            secondsLeft--;
            if (countSpan) countSpan.textContent = secondsLeft;

            if (secondsLeft <= 0) {
                clearInterval(interval);
                // Habilitar botón
                if (countText) countText.style.display = 'none';
                if (skipBtn) {
                    skipBtn.classList.add('active');
                    skipBtn.onclick = () => {
                        adOverlay.style.display = 'none';
                        // El timer principal sigue corriendo para el próximo anuncio en 5 min
                    };
                }
            }
        }, 1000);
    }

    // --- 6. UTILIDADES Y HELPERS ---

    // Renderizado genérico de grids (Home y Bottom de juego)
    function renderGamesGrid(games, containerId) {
        const grid = document.getElementById(containerId);
        if (!grid) return;
        
        grid.innerHTML = '';

        if (!games || games.length === 0) {
            grid.innerHTML = '<p style="grid-column:1/-1; text-align:center;">No hay juegos para mostrar.</p>';
            return;
        }

        games.forEach(game => {
            const card = document.createElement('a');
            // Link al juego
            card.href = `juego.html?slug=${game.slug || createSlug(game.title)}&id=${game._id}`;
            card.className = 'game-card';
            
            // Imagen fallback
            const imgUrl = game.thumbnailUrl || 'https://via.placeholder.com/300x200';
            const desc = game.description ? (game.description.substring(0, 60) + '...') : `Juega ${game.title} gratis.`;

            card.innerHTML = `
                <div class="game-thumbnail-wrapper">
                    <img src="${imgUrl}" alt="${game.title}" class="game-thumbnail" loading="lazy">
                </div>
                <div class="game-info">
                    <div class="game-title">${game.title}</div>
                    <div class="game-description">${desc}</div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function initGlobalListeners() {
        // Menú Móvil
        if (menuBtn && menu) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('active');
                if(overlay) overlay.style.display = menu.classList.contains('active') ? 'block' : 'none';
            });

            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && e.target !== menuBtn) {
                    menu.classList.remove('active');
                    if(overlay) overlay.style.display = 'none';
                }
            });
        }
    }

    function updatePagination(data) {
        const container = document.getElementById('pagination-container');
        if(!container) return;

        state.totalPages = data.totalPaginas;
        const pageInfo = document.getElementById('page-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (state.totalPages > 1) {
            container.style.display = 'flex';
            if(pageInfo) pageInfo.textContent = `Página ${data.paginaActual} de ${data.totalPaginas}`;
            if(prevBtn) prevBtn.disabled = data.paginaActual === 1;
            if(nextBtn) nextBtn.disabled = data.paginaActual === data.totalPaginas;
        } else {
            container.style.display = 'none';
        }
    }

    function updateCategoryActiveState(category) {
        document.querySelectorAll('.category').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) btn.classList.add('active');
        });
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function createSlug(text) {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }
});