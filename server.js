// ==========================================================
//               SERVER.JS (VERSIÓN AVANZADA) - PARTE 1 DE 6
//      (CONFIGURACIÓN INICIAL Y SCHEMAS DETALLADOS)
// ==========================================================

// IMPORTACIONES Y CONFIGURACIÓN INICIAL
// =============================================
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const multer = require('multer');
const ejs = require('ejs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const rateLimit = require('express-rate-limit');
const { JSDOM } = require('jsdom');
const DOMPurify = require('dompurify');
const cookieParser = require('cookie-parser');

// Configuración básica del servidor
const app = express();
app.set('trust proxy', 1); 
const server = http.createServer(app);
const io = new Server(server); // Integración de Socket.IO para el chat
const PORT = process.env.PORT || 3000;

const window = new JSDOM('').window;
const purify = DOMPurify(window);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', ejs.renderFile);

// =============================================
// CONEXIÓN A MONGODB
// =============================================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/brainrot_marketplace_pro')
  .then(() => console.log('✅ Conectado a MongoDB (Versión PRO)'))
  .catch(err => console.error('❌ Error de conexión a MongoDB:', err));

// =============================================
// CONFIGURACIÓN DE CLOUDINARY (PARA IMÁGENES)
// =============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'brainrot_marketplace_pro',
        allowed_formats: ['jpeg', 'png', 'jpg'],
        transformation: [{ quality: "auto:good", fetch_format: "auto" }]
    }
});

const upload = multer({ storage: storage });

// =============================================
// MODELOS DE DATOS AVANZADOS (SCHEMAS)
// =============================================

// --- Schema de Calificaciones ---
const ratingSchema = new mongoose.Schema({
    raterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ratedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    stars: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxLength: 280 }
}, { timestamps: true });

// --- Schema de Usuarios (Actualizado) ---
const userSchema = new mongoose.Schema({
    robloxUsername: { type: String, required: true, unique: true, trim: true, lowercase: true },
    robloxId: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    tusinimonedas: { type: Number, default: 0 },
    profilePic: { type: String, default: 'https://res.cloudinary.com/dmedd6w1q/image/upload/v1752519015/Gemini_Generated_Image_jafmcpjafmcpjafm_i5ptpl.png' },
    isBanned: { type: Boolean, default: false },
    role: { type: String, enum: ['User', 'Admin'], default: 'User' },
    // Campos para el sistema de reputación
    ratings: [ratingSchema],
    averageRating: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalPurchases: { type: Number, default: 0 }
}, { timestamps: true });

// --- Schema de Brainrots (Actualizado para subastas) ---
const brainrotSchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String, required: true },
    listingType: { type: String, enum: ['fixed_price', 'auction'], default: 'fixed_price' },
    price: { type: Number, min: 1 }, // Precio para 'fixed_price'
    startBid: { type: Number, min: 1 }, // Precio inicial para 'auction'
    currentBid: { type: Number },
    highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    auctionEndsAt: { type: Date },
    status: { type: String, enum: ['available', 'in_transaction', 'sold', 'delisted'], default: 'available' },
    category: { type: String, default: 'General' },
    rarity: { type: String, default: 'Común' },
    views: { type: Number, default: 0 }
}, { timestamps: true });

// --- Schema de Mensajes para el Chat ---
const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String },
    imageUrl: { type: String } // Para enviar capturas
}, { timestamps: true });

// --- Schema de Transacciones (Actualizado para Escrow) ---
const transactionSchema = new mongoose.Schema({
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    brainrotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brainrot', required: true },
    amount: { type: Number, required: true }, // Precio final de la venta
    status: {
        type: String,
        enum: [
            'pending_delivery',     // El vendedor debe entregar el item
            'delivery_confirmed',   // El comprador confirmó la entrega, pendiente de pago
            'completed',            // Pago liberado al vendedor
            'in_dispute',           // El comprador o vendedor inició una disputa
            'cancelled'             // Reembolsado por un admin
        ],
        default: 'pending_delivery'
    },
    chat: [messageSchema] // Chat embebido en la transacción
}, { timestamps: true });

// --- Schema de Logs del Administrador ---
const adminLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // Ej: "acredito_monedas", "resolvio_disputa", "baneo_usuario"
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    details: { type: String } // Ej: "Acreditó 1000 monedas a 'usuarioX'"
}, { timestamps: true });

// Declaración de todos los modelos
const User = mongoose.model('User', userSchema);
const Brainrot = mongoose.model('Brainrot', brainrotSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const AdminLog = mongoose.model('AdminLog', adminLogSchema);
const Rating = mongoose.model('Rating', ratingSchema);


// =============================================
//               FIN DE LA PARTE 1
// =============================================


// ==========================================================
//               SERVER.JS (VERSIÓN AVANZADA) - PARTE 2 DE 6
//              (MIDDLEWARES Y AUTENTICACIÓN)
// ==========================================================

// MIDDLEWARES Y CONFIGURACIÓN DE EXPRESS
// =============================================
const generalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutos
	max: 200,
	standardHeaders: true,
	legacyHeaders: false,
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// La sesión debe ser compartida con Socket.IO
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'brainrot-super-secret-key-pro',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: 'auto', sameSite: 'lax' }
});
app.use(sessionMiddleware);
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});


app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use(generalLimiter);

// Middleware para pasar datos útiles a todas las vistas
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.path = req.path;
    res.locals.query = req.query;
    res.locals.baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    next();
});


// =============================================
// CONFIGURACIÓN DE PASSPORT (AUTENTICACIÓN)
// =============================================
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return done(null, false, { message: 'El correo o la contraseña son incorrectos.' });
        }
        if (user.isBanned) {
            return done(null, false, { message: 'Esta cuenta ha sido suspendida.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return done(null, false, { message: 'El correo o la contraseña son incorrectos.' });
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Middlewares de protección de rutas
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        if (req.user.isBanned) {
            req.logout((err) => {
                if(err) return next(err);
                res.status(403).render('error', { message: 'Tu cuenta ha sido suspendida.' });
            });
        } else {
            return next();
        }
    } else {
        res.redirect('/login');
    }
};

const requireAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'Admin') {
        return next();
    } else {
        res.status(403).render('error', { message: "Acceso denegado. No tienes permisos de administrador." });
    }
};

// =============================================
// RUTAS DE AUTENTICACIÓN Y PÁGINAS BÁSICAS
// =============================================
app.get('/', (req, res) => res.redirect('/marketplace'));
app.get('/how-it-works', (req, res) => res.render('how-it-works')); // Página para recargar monedas

// --- Registro ---
app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', loginLimiter, async (req, res, next) => {
    try {
        const { robloxUsername, email, password } = req.body;
        if (!robloxUsername || !email || !password) {
            throw new Error("Todos los campos son obligatorios.");
        }
        if (password.length < 6) {
            throw new Error("La contraseña debe tener al menos 6 caracteres.");
        }
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { robloxUsername: robloxUsername.toLowerCase() }]
        });
        if (existingUser) {
            throw new Error('El email o el nombre de usuario de Roblox ya están en uso.');
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ robloxUsername, email, password: hashedPassword });
        await user.save();

        req.login(user, (err) => {
            if (err) return next(err);
            res.redirect('/marketplace');
        });
    } catch (err) {
        res.render('register', { error: err.message });
    }
});

// --- Login y Logout ---
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', loginLimiter, passport.authenticate('local', {
    successRedirect: '/marketplace',
    failureRedirect: '/login',
}));

app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.session.destroy(() => res.redirect('/'));
    });
});


// =============================================
//               FIN DE LA PARTE 2
// =============================================

// ==========================================================
//               SERVER.JS (VERSIÓN AVANZADA) - PARTE 3 DE 6
//            (RUTAS PRINCIPALES DEL MARKETPLACE Y COMPRA)
// ==========================================================

// =============================================
// RUTAS DEL MARKETPLACE Y GESTIÓN DE BRAINROTS
// =============================================

// --- Mostrar la página principal del Marketplace ---
app.get('/marketplace', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 12;
        let query = { status: 'available' }; // Solo mostrar artículos disponibles
        const { q, category, rarity } = req.query;

        if (q) {
            query.title = { $regex: q, $options: 'i' };
        }
        if (category) query.category = category;
        if (rarity) query.rarity = rarity;

        const totalItems = await Brainrot.countDocuments(query);
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const brainrots = await Brainrot.find(query)
            .populate('sellerId', 'robloxUsername')
            .sort({ createdAt: -1 })
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage);

        res.render('index', {
            brainrots: brainrots,
            currentPage: page,
            totalPages,
            query: req.query
        });
    } catch (err) {
        next(err);
    }
});

// --- Mostrar el formulario para publicar un nuevo Brainrot ---
app.get('/publish-brainrot', requireAuth, (req, res) => {
    res.render('publish-brainrot', { error: null });
});

// --- Procesar la publicación de un nuevo Brainrot ---
app.post('/publish-brainrot', requireAuth, upload.single('image'), async (req, res, next) => {
    try {
        const { title, description, price, category, rarity } = req.body;
        if (!req.file) throw new Error("Debes subir una imagen del Brainrot.");
        if (!title || !price) throw new Error("El título y el precio son obligatorios.");
        if (parseInt(price) <= 0) throw new Error("El precio debe ser un número positivo.");

        const newBrainrot = new Brainrot({
            sellerId: req.user._id,
            title: purify.sanitize(title),
            description: purify.sanitize(description),
            price: parseInt(price),
            imageUrl: req.file.path,
            category: purify.sanitize(category) || 'General',
            rarity: purify.sanitize(rarity) || 'Común',
            listingType: 'fixed_price' // Por ahora solo precio fijo
        });

        await newBrainrot.save();
        res.redirect('/marketplace');
    } catch (err) {
        res.render('publish-brainrot', { error: err.message });
    }
});

// --- Mostrar la página de detalle de un Brainrot ---
app.get('/brainrot/:id', async (req, res, next) => {
    try {
        const brainrot = await Brainrot.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true })
            .populate('sellerId', 'robloxUsername profilePic averageRating totalSales');

        if (!brainrot || brainrot.status === 'delisted') {
            return res.status(404).render('error.html', { message: 'Este Brainrot no fue encontrado.' });
        }
        
        const isOwner = req.user && req.user._id.equals(brainrot.sellerId._id);
        
        res.render('brainrot-detail', {
            brainrot,
            isOwner,
            pageTitle: `${brainrot.title} - Brainrot Marketplace`
        });
    } catch (err) {
        next(err);
    }
});

// =============================================
// LÓGICA DE COMPRA CON INTERMEDIARIO (ESCROW)
// =============================================
app.post('/brainrot/:id/buy', requireAuth, async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const brainrotId = req.params.id;
        const buyer = await User.findById(req.user._id).session(session);
        const brainrot = await Brainrot.findById(brainrotId).session(session);

        if (!brainrot || brainrot.status !== 'available') {
            throw new Error('Este Brainrot ya no está disponible para la compra.');
        }
        if (buyer._id.equals(brainrot.sellerId)) {
            throw new Error('No puedes comprar tu propio artículo.');
        }
        if (buyer.tusinimonedas < brainrot.price) {
            throw new Error('No tienes suficientes tusinimonedas. Recarga en nuestro juego de Roblox.');
        }

        const seller = await User.findById(brainrot.sellerId).session(session);

        // 1. Descontar monedas al comprador y ponerlas "en espera"
        buyer.tusinimonedas -= brainrot.price;
        await buyer.save({ session });

        // 2. Marcar el Brainrot como "en transacción" para que nadie más lo compre
        brainrot.status = 'in_transaction';
        await brainrot.save({ session });
        
        // 3. Crear el registro de la transacción con el chat inicial
        const transaction = new Transaction({
            buyerId: buyer._id,
            sellerId: seller._id,
            brainrotId: brainrot._id,
            amount: brainrot.price,
            status: 'pending_delivery',
            chat: [{
                senderId: null, // Mensaje del sistema
                text: `¡Transacción iniciada! El comprador (${buyer.robloxUsername}) y el vendedor (${seller.robloxUsername}) deben coordinar la entrega.`
            }]
        });
        await transaction.save({ session });
        
        await session.commitTransaction();
        
        // Redirige al usuario a la página de la transacción
        res.redirect(`/transaction/${transaction._id}`);

    } catch (err) {
        await session.abortTransaction();
        res.status(400).render('error', { message: err.message });
    } finally {
        session.endSession();
    }
});

// =============================================
//               FIN DE LA PARTE 3
// =============================================

// ==========================================================
//               SERVER.JS (VERSIÓN AVANZADA) - PARTE 4 DE 6
//                (GESTIÓN DE TRANSACCIONES Y CHAT)
// ==========================================================

// =============================================
// RUTAS DE TRANSACCIONES Y CHAT
// =============================================

// --- Página de la transacción individual (el "centro de encuentro") ---
app.get('/transaction/:id', requireAuth, async (req, res, next) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
            .populate('buyerId', 'robloxUsername')
            .populate('sellerId', 'robloxUsername')
            .populate('brainrotId');

        if (!transaction) {
            return res.status(404).render('error', { message: 'Transacción no encontrada.' });
        }

        // Asegurarse de que solo el comprador, el vendedor o un admin puedan ver esta página
        const isBuyer = req.user._id.equals(transaction.buyerId._id);
        const isSeller = req.user._id.equals(transaction.sellerId._id);
        const isAdmin = req.user.role === 'Admin';

        if (!isBuyer && !isSeller && !isAdmin) {
            return res.status(403).render('error', { message: 'No tienes permiso para ver esta transacción.' });
        }

        res.render('transaction-detail', {
            transaction,
            isBuyer,
            isSeller,
            pageTitle: `Transacción para: ${transaction.brainrotId.title}`
        });

    } catch (err) {
        next(err);
    }
});


// --- Acción del comprador: Confirmar que recibió el artículo ---
app.post('/transaction/:id/confirm-delivery', requireAuth, async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const transaction = await Transaction.findById(req.params.id).session(session);
        if (!transaction || !req.user._id.equals(transaction.buyerId)) {
            throw new Error('Acción no autorizada.');
        }
        if (transaction.status !== 'pending_delivery') {
            throw new Error('Esta transacción no está esperando confirmación.');
        }

        // 1. Actualizar el estado de la transacción
        transaction.status = 'completed';
        
        // 2. Liberar el pago al vendedor
        const seller = await User.findById(transaction.sellerId).session(session);
        seller.tusinimonedas += transaction.amount;
        seller.totalSales += 1;
        await seller.save({ session });

        // 3. Actualizar estadísticas del comprador
        const buyer = await User.findById(transaction.buyerId).session(session);
        buyer.totalPurchases += 1;
        await buyer.save({ session });
        
        // 4. Añadir mensaje del sistema al chat
        transaction.chat.push({
            senderId: null,
            text: `¡Entrega confirmada! Se han liberado ${transaction.amount} tusinimonedas al vendedor. La transacción ha sido completada.`
        });
        await transaction.save({ session });

        await session.commitTransaction();
        res.redirect(`/transaction/${transaction._id}`);

    } catch (err) {
        await session.abortTransaction();
        next(err);
    } finally {
        session.endSession();
    }
});

// --- Acción de comprador/vendedor: Iniciar una disputa ---
app.post('/transaction/:id/raise-dispute', requireAuth, async (req, res, next) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        const isParticipant = req.user._id.equals(transaction.buyerId) || req.user._id.equals(transaction.sellerId);

        if (!transaction || !isParticipant) {
            throw new Error('Acción no autorizada.');
        }

        transaction.status = 'in_dispute';
        transaction.chat.push({
            senderId: null,
            text: `${req.user.robloxUsername} ha iniciado una disputa. Un administrador revisará el caso.`
        });
        await transaction.save();

        res.redirect(`/transaction/${transaction._id}`);
    } catch (err) {
        next(err);
    }
});


// =============================================
// LÓGICA DEL CHAT EN TIEMPO REAL CON SOCKET.IO
// =============================================
io.on('connection', (socket) => {
    const session = socket.request.session;
    const userId = session.passport ? session.passport.user : null;

    if (!userId) {
        return; // No permitir conexiones sin autenticación
    }

    // El cliente se une a una "sala" específica para su transacción
    socket.on('join_transaction_room', (transactionId) => {
        socket.join(transactionId);
    });

    // Escuchar por nuevos mensajes
    socket.on('send_message', async (data) => {
        try {
            const { transactionId, messageText, imageUrl } = data;
            const transaction = await Transaction.findById(transactionId);

            // Validar que el usuario sea parte de la transacción
            const isParticipant = transaction.buyerId.equals(userId) || transaction.sellerId.equals(userId);
            if (!isParticipant) return;

            const newMessage = {
                senderId: userId,
                text: messageText ? purify.sanitize(messageText) : null,
                imageUrl: imageUrl || null
            };

            transaction.chat.push(newMessage);
            await transaction.save();
            
            // Poblar el nombre de usuario para mostrarlo en el frontend
            const populatedMessage = { ...newMessage, sender: { _id: userId, robloxUsername: (await User.findById(userId)).robloxUsername } };

            // Enviar el mensaje a todos en la sala de la transacción
            io.to(transactionId).emit('receive_message', populatedMessage);

        } catch (error) {
            console.error("Error en Socket.IO:", error);
        }
    });

    socket.on('disconnect', () => {
        // Lógica de desconexión si es necesaria
    });
});


// =============================================
//               FIN DE LA PARTE 4
// =============================================



// ==========================================================
//               SERVER.JS (VERSIÓN AVANZADA) - PARTE 5 DE 6
//            (PERFILES DE USUARIO Y CALIFICACIONES)
// ==========================================================


// =============================================
// RUTAS DE PERFIL DE USUARIO Y CALIFICACIONES
// =============================================

// --- Página para ver las compras realizadas por el usuario actual ---
app.get('/my-purchases', requireAuth, async (req, res, next) => {
    try {
        const transactions = await Transaction.find({ buyerId: req.user._id })
            .populate('brainrotId', 'title')
            .populate('sellerId', 'robloxUsername')
            .sort({ createdAt: -1 });
        
        res.render('my-purchases', { transactions });
    } catch (err) {
        next(err);
    }
});

// --- Página para ver los Brainrots publicados por el usuario actual ---
app.get('/my-publications', requireAuth, async (req, res, next) => {
    try {
        const publications = await Brainrot.find({ sellerId: req.user._id })
            .sort({ createdAt: -1 });

        res.render('my-publications', { publications });
    } catch (err) {
        next(err);
    }
});

// --- Página de perfil público de un usuario ---
app.get('/profile/:username', async (req, res, next) => {
    try {
        const userProfile = await User.findOne({ robloxUsername: req.params.username.toLowerCase() });
        if (!userProfile || userProfile.isBanned) {
            return res.status(404).render('error', { message: 'Usuario no encontrado.' });
        }

        // Obtener los artículos que este usuario está vendiendo actualmente
        const itemsForSale = await Brainrot.find({ sellerId: userProfile._id, status: 'available' })
            .sort({ createdAt: -1 });
            
        // Obtener las calificaciones recibidas por este usuario
        const ratings = await Rating.find({ ratedUserId: userProfile._id })
            .populate('raterId', 'robloxUsername profilePic')
            .sort({ createdAt: -1 });

        res.render('profile', {
            userProfile,
            itemsForSale,
            ratings
        });
    } catch (err) {
        next(err);
    }
});

// --- Ruta para calificar a otro usuario después de una transacción ---
app.post('/transaction/:id/rate', requireAuth, async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { stars, comment, ratedUserId } = req.body;
        const transactionId = req.params.id;
        
        const transaction = await Transaction.findById(transactionId).session(session);
        if (!transaction || transaction.status !== 'completed') {
            throw new Error('Solo puedes calificar transacciones completadas.');
        }

        // Validar que el calificador sea parte de la transacción
        const raterId = req.user._id;
        const isParticipant = raterId.equals(transaction.buyerId) || raterId.equals(transaction.sellerId);
        if (!isParticipant) {
            throw new Error('No eres parte de esta transacción.');
        }

        // Validar que el usuario calificado también sea parte de la transacción
        const isRatedUserParticipant = ratedUserId.equals(transaction.buyerId.toString()) || ratedUserId.equals(transaction.sellerId.toString());
        if (!isRatedUserParticipant || raterId.equals(ratedUserId)) {
            throw new Error('No puedes calificar a este usuario en esta transacción.');
        }

        // Revisar si ya existe una calificación para esta transacción por este usuario
        const existingRating = await Rating.findOne({ transactionId, raterId }).session(session);
        if (existingRating) {
            throw new Error('Ya has calificado esta transacción.');
        }
        
        // Crear la nueva calificación
        const newRating = new Rating({
            raterId,
            ratedUserId,
            transactionId,
            stars: parseInt(stars),
            comment: purify.sanitize(comment)
        });
        await newRating.save({ session });

        // Actualizar el promedio del usuario calificado
        const ratedUser = await User.findById(ratedUserId).session(session);
        const allRatingsForUser = await Rating.find({ ratedUserId: ratedUserId }).session(session);
        const totalStars = allRatingsForUser.reduce((acc, r) => acc + r.stars, 0);
        ratedUser.averageRating = (totalStars / allRatingsForUser.length).toFixed(1);
        
        await ratedUser.save({ session });

        await session.commitTransaction();
        res.redirect(`/transaction/${transactionId}`);

    } catch (err) {
        await session.abortTransaction();
        next(err);
    } finally {
        session.endSession();
    }
});


// --- Página para ver las ventas realizadas por el usuario actual ---
app.get('/my-sales', requireAuth, async (req, res, next) => {
    try {
        const transactions = await Transaction.find({ sellerId: req.user._id })
            .populate('brainrotId', 'title')
            .populate('buyerId', 'robloxUsername')
            .sort({ createdAt: -1 });
        
        // Renderiza la nueva vista que crearemos en el siguiente paso
        res.render('my-sales', { transactions });
    } catch (err) {
        next(err);
    }
});

// =============================================
//               FIN DE LA PARTE 5
// =============================================



// ==========================================================
//               SERVER.JS (VERSIÓN AVANZADA) - PARTE 6 DE 6
//                  (RUTAS DE ADMIN Y CIERRE)
// ==========================================================

// =============================================
// RUTAS DEL PANEL DE ADMINISTRACIÓN
// =============================================
app.get('/admin', requireAdmin, (req, res) => res.redirect('/admin/dashboard'));

// --- Dashboard del Administrador ---
app.get('/admin/dashboard', requireAdmin, async (req, res, next) => {
    try {
        const [totalUsers, totalBrainrots, totalSold, totalDisputes] = await Promise.all([
            User.countDocuments(),
            Brainrot.countDocuments(),
            Transaction.countDocuments({ status: 'completed' }),
            Transaction.countDocuments({ status: 'in_dispute' })
        ]);
        res.render('admin/dashboard', { stats: { totalUsers, totalBrainrots, totalSold, totalDisputes }, path: req.path });
    } catch (err) { next(err); }
});

// --- Gestión de Usuarios ---
app.get('/admin/users', requireAdmin, async (req, res, next) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.render('admin/users', { users, path: req.path, query: req.query });
    } catch (err) { next(err); }
});

// --- Añadir monedas y banear (ya existentes) ---
app.post('/admin/user/:id/add-currency', requireAdmin, async (req, res, next) => {
    try {
        const { amount } = req.body;
        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum <= 0) throw new Error("Cantidad inválida.");
        
        const user = await User.findByIdAndUpdate(req.params.id, { $inc: { tusinimonedas: amountNum } }, { new: true });
        
        await new AdminLog({
            adminId: req.user._id,
            action: 'acredito_monedas',
            targetUserId: user._id,
            details: `Acreditó ${amountNum} tusinimonedas a ${user.robloxUsername}`
        }).save();

        res.redirect(`/admin/user/${user._id}/manage-currency`);
    } catch (err) { next(err); }
});

app.post('/admin/user/:id/toggle-ban', requireAdmin, async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (user && user.role !== 'Admin') {
            user.isBanned = !user.isBanned;
            await user.save();
        }
        res.redirect('/admin/users');
    } catch (err) { next(err); }
});


// --- Gestión de Disputas ---
app.get('/admin/disputes', requireAdmin, async (req, res, next) => {
    try {
        const disputes = await Transaction.find({ status: 'in_dispute' })
            .populate('buyerId', 'robloxUsername')
            .populate('sellerId', 'robloxUsername')
            .populate('brainrotId', 'title');
        res.render('admin/disputes', { disputes, path: req.path });
    } catch (err) { next(err); }
});

// --- Acción del Admin: Reembolsar al comprador ---
app.post('/admin/transaction/:id/refund', requireAdmin, async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const transaction = await Transaction.findById(req.params.id).session(session);
        if (!transaction || transaction.status !== 'in_dispute') throw new Error('Transacción no válida para reembolso.');

        // 1. Devolver las monedas al comprador
        await User.findByIdAndUpdate(transaction.buyerId, { $inc: { tusinimonedas: transaction.amount } }).session(session);
        
        // 2. Volver a poner el Brainrot a la venta
        await Brainrot.findByIdAndUpdate(transaction.brainrotId, { status: 'available' }).session(session);
        
        // 3. Actualizar la transacción a "cancelada"
        transaction.status = 'cancelled';
        transaction.chat.push({ senderId: null, text: `Disputa resuelta por un administrador. El pago ha sido reembolsado al comprador.` });
        await transaction.save({ session });

        await new AdminLog({
            adminId: req.user._id, action: 'reembolso', targetUserId: transaction.buyerId,
            details: `Reembolsó ${transaction.amount} monedas al comprador en la transacción ${transaction._id}`
        }).save({ session });
        
        await session.commitTransaction();
        res.redirect('/admin/disputes');
    } catch (err) {
        await session.abortTransaction();
        next(err);
    } finally {
        session.endSession();
    }
});

// --- Acción del Admin: Forzar liberación de pago al vendedor ---
app.post('/admin/transaction/:id/release-payment', requireAdmin, async (req, res, next) => {
    // Esta lógica es casi idéntica a "confirm-delivery", pero la ejecuta un admin
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const transaction = await Transaction.findById(req.params.id).session(session);
        if (!transaction || transaction.status !== 'in_dispute') throw new Error('Transacción no válida para esta acción.');

        transaction.status = 'completed';
        await User.findByIdAndUpdate(transaction.sellerId, { $inc: { tusinimonedas: transaction.amount, totalSales: 1 } }).session(session);
        await User.findByIdAndUpdate(transaction.buyerId, { $inc: { totalPurchases: 1 } }).session(session);
        
        transaction.chat.push({ senderId: null, text: `Disputa resuelta por un administrador. El pago ha sido liberado al vendedor.` });
        await transaction.save({ session });
        
        await new AdminLog({
            adminId: req.user._id, action: 'libero_pago', targetUserId: transaction.sellerId,
            details: `Liberó ${transaction.amount} monedas al vendedor en la transacción ${transaction._id}`
        }).save({ session });

        await session.commitTransaction();
        res.redirect('/admin/disputes');
    } catch (err) {
        await session.abortTransaction();
        next(err);
    } finally {
        session.endSession();
    }
});




// --- Dashboard Económico del Administrador ---
app.get('/admin/economic-dashboard', requireAdmin, async (req, res, next) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));

        // 1. Calcular la masa monetaria total
        const totalCurrencyResult = await User.aggregate([
            { $group: { _id: null, total: { $sum: "$tusinimonedas" } } }
        ]);
        const totalCurrency = totalCurrencyResult.length > 0 ? totalCurrencyResult[0].total : 0;

        // 2. Calcular las monedas en tránsito (escrow)
        const escrowResult = await Transaction.aggregate([
            { $match: { status: { $in: ['pending_delivery', 'in_dispute'] } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const currencyInEscrow = escrowResult.length > 0 ? escrowResult[0].total : 0;

        // 3. Calcular el volumen de transacciones completadas hoy
        const volume24hResult = await Transaction.aggregate([
            { $match: { status: 'completed', updatedAt: { $gte: startOfToday } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const volume24h = volume24hResult.length > 0 ? volume24hResult[0].total : 0;
        
        // 4. Contar nuevos usuarios y artículos de hoy
        const newUsersToday = await User.countDocuments({ createdAt: { $gte: startOfToday } });
        const newBrainrotsToday = await Brainrot.countDocuments({ createdAt: { $gte: startOfToday } });
        
        const stats = {
            totalCurrency,
            currencyInEscrow,
            volume24h,
            newUsersToday,
            newBrainrotsToday
        };

        res.render('admin/economic-dashboard', { stats, path: req.path });
    } catch (err) {
        next(err);
    }
});


// --- Gestión Integral de Artículos (Brainrots) ---
app.get('/admin/articles', requireAdmin, async (req, res, next) => {
    try {
        const articles = await Brainrot.find({})
            .populate('sellerId', 'robloxUsername')
            .sort({ createdAt: -1 });
        
        res.render('admin/articles', { articles, path: req.path });
    } catch (err) {
        next(err);
    }
});

// --- Forzar la eliminación de un artículo ---
app.post('/admin/article/:id/delete', requireAdmin, async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const articleId = req.params.id;
        const article = await Brainrot.findById(articleId).session(session);

        if (!article) {
            throw new Error('Artículo no encontrado.');
        }

        // Si el artículo está en una transacción, cancelarla y reembolsar
        const transaction = await Transaction.findOne({ brainrotId: articleId, status: { $in: ['pending_delivery', 'in_dispute'] } }).session(session);
        if (transaction) {
            // Devolver dinero al comprador
            await User.findByIdAndUpdate(transaction.buyerId, { $inc: { tusinimonedas: transaction.amount } }).session(session);
            // Marcar transacción como cancelada
            transaction.status = 'cancelled';
            transaction.chat.push({ senderId: null, text: `La transacción fue cancelada por un administrador porque el artículo fue eliminado.` });
            await transaction.save({ session });
        }
        
        // Eliminar la imagen de Cloudinary
        if (article.imageUrl) {
            const publicId = article.imageUrl.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`brainrot_marketplace_pro/${publicId}`);
        }

        // Eliminar el artículo de la base de datos
        await Brainrot.findByIdAndDelete(articleId).session(session);

        await new AdminLog({
            adminId: req.user._id,
            action: 'elimino_articulo',
            details: `Eliminó el artículo '${article.title}' (ID: ${articleId})`
        }).save({ session });
        
        await session.commitTransaction();
        res.redirect('/admin/articles');

    } catch (err) {
        await session.abortTransaction();
        next(err);
    } finally {
        session.endSession();
    }
});



// --- Visualizador de Todas las Transacciones ---
app.get('/admin/transactions', requireAdmin, async (req, res, next) => {
    try {
        const transactions = await Transaction.find({})
            .populate('buyerId', 'robloxUsername')
            .populate('sellerId', 'robloxUsername')
            .populate('brainrotId', 'title')
            .sort({ createdAt: -1 });
            
        res.render('admin/transactions', { transactions, path: req.path });
    } catch (err) {
        next(err);
    }
});

// --- Visualizador de Logs de Administrador ---
app.get('/admin/logs', requireAdmin, async (req, res, next) => {
    try {
        const logs = await AdminLog.find({})
            .populate('adminId', 'robloxUsername')
            .populate('targetUserId', 'robloxUsername')
            .sort({ createdAt: -1 });

        res.render('admin/logs', { logs, path: req.path });
    } catch (err) {
        next(err);
    }
});


// --- Página de Movimientos y Estado de Cuenta del Usuario ---
app.get('/my-movements', requireAuth, async (req, res, next) => {
    try {
        const userId = req.user._id;

        // 1. Calcular el total gastado en compras completadas
        const spentResult = await Transaction.aggregate([
            { $match: { buyerId: userId, status: 'completed' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalSpent = spentResult.length > 0 ? spentResult[0].total : 0;

        // 2. Calcular el total ganado por ventas completadas
        const earnedResult = await Transaction.aggregate([
            { $match: { sellerId: userId, status: 'completed' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalEarned = earnedResult.length > 0 ? earnedResult[0].total : 0;
        
        // 3. Calcular el saldo pendiente de recibir (en escrow como vendedor)
        const escrowResult = await Transaction.aggregate([
            { $match: { sellerId: userId, status: 'pending_delivery' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const pendingBalance = escrowResult.length > 0 ? escrowResult[0].total : 0;

        // 4. Obtener una lista unificada de movimientos (compras y ventas)
        const purchases = await Transaction.find({ buyerId: userId })
            .populate('brainrotId', 'title')
            .select('amount status createdAt')
            .lean(); // .lean() para convertirlo en objeto JS simple

        const sales = await Transaction.find({ sellerId: userId })
            .populate('brainrotId', 'title')
            .select('amount status createdAt')
            .lean();

        // Combinar y dar formato a los movimientos
        let movements = [];
        purchases.forEach(p => movements.push({
            date: p.createdAt,
            type: 'Compra',
            description: p.brainrotId ? p.brainrotId.title : 'Artículo eliminado',
            amount: -p.amount, // Negativo porque es un gasto
            status: p.status
        }));
        sales.forEach(s => movements.push({
            date: s.createdAt,
            type: 'Venta',
            description: s.brainrotId ? s.brainrotId.title : 'Artículo eliminado',
            amount: s.amount, // Positivo porque es un ingreso
            status: s.status
        }));
        
        // Ordenar los movimientos por fecha, del más reciente al más antiguo
        movements.sort((a, b) => new Date(b.date) - new Date(a.date));

        const stats = {
            totalSpent,
            totalEarned,
            pendingBalance
        };

        res.render('my-movements', { stats, movements });

    } catch (err) {
        next(err);
    }
});


// ==========================================================
//      ENDPOINT FINAL Y COMPLETO PARA RECIBIR COMPRAS DE ROBLOX
// ==========================================================
app.post('/api/recibir-compra-roblox', async (req, res) => {
    
    // Recibimos los datos que nos envía el script de Roblox
    const { claveSecreta, robloxUsername, monedasAAgregar } = req.body;

    console.log('Recibida petición de compra desde Roblox:', req.body);

    // --- 1. Verificación de Seguridad ---
    // Comparamos la clave secreta recibida con la que tenemos en el archivo .env
    if (claveSecreta !== process.env.ROBLOX_API_SECRET) {
        console.warn('¡ALERTA! Intento de acceso a la API con clave secreta incorrecta.');
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    // --- 2. Validación de Datos ---
    if (!robloxUsername || !monedasAAgregar || monedasAAgregar <= 0) {
        console.error('ERROR: Petición de Roblox recibida con datos incompletos o inválidos.');
        return res.status(400).json({ error: 'Datos inválidos.' });
    }

    try {
        // --- 3. Buscar y Actualizar al Usuario ---
        // Buscamos al usuario por su 'robloxUsername', convirtiéndolo a minúsculas para coincidir con cómo se guarda en la DB.
        const user = await User.findOneAndUpdate(
            { robloxUsername: robloxUsername.toLowerCase() },
            { $inc: { tusinimonedas: monedasAAgregar } },
            { new: true } // Esto nos devuelve el documento del usuario ya actualizado
        );

        if (!user) {
            // Si no se encuentra un usuario con ese nombre en tu web, se registra el error.
            console.error(`ERROR: No se encontró un usuario con el Roblox Username: ${robloxUsername}`);
            return res.status(404).json({ error: 'Usuario no encontrado en la base de datos del marketplace.' });
        }

        // --- 4. Registrar la Acción (opcional pero recomendado) ---
        const log = new AdminLog({
            action: 'acredito_monedas_roblox',
            targetUserId: user._id,
            details: `Acreditación automática de ${monedasAAgregar} tusinimonedas por compra en Roblox. Nuevo balance: ${user.tusinimonedas}.`
        });
        await log.save();

        console.log(`ÉXITO: Se acreditaron ${monedasAAgregar} tusinimonedas a ${user.robloxUsername}.`);

        // --- 5. Responder a Roblox ---
        // Enviamos una respuesta exitosa para que Roblox sepa que todo salió bien.
        res.status(200).json({ message: 'Monedas acreditadas correctamente.' });

    } catch (error) {
        console.error('ERROR CRÍTICO al procesar la compra de Roblox:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar la base de datos.' });
    }
});


// =============================================
// MANEJADORES DE ERRORES Y ARRANQUE DEL SERVIDOR
// =============================================
app.use((req, res, next) => {
    res.status(404).render('error', { message: 'Página no encontrada (404)' });
});

app.use((err, req, res, next) => {
  console.error("❌ ERROR GLOBAL CAPTURADO:", err.stack);
  const status = err.status || 500;
  const message = err.message || 'Ocurrió un error inesperado en el servidor.';
  res.status(status).render('error', { message });
});

server.listen(PORT, () => console.log(`🚀 Servidor Brainrot Marketplace (PRO) corriendo en http://localhost:${PORT}`));

// =============================================
//               FIN DEL ARCHIVO
// =============================================