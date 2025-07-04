const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

exports.iniciarSesion = async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
        return res.status(400).json({ errores: errores.array() });
    }

    const { usuario, password } = req.body;

    try {
        const usuarioExistente = await Usuario.findOne({ usuario }).populate('farmacia', 'nombre direccion telefono');

        if (!usuarioExistente) {
            return res.status(400).json({ mensaje: 'Credenciales incorrectas' });
        }

        // 🔹 **Verificar contraseña**
        const esCorrecto = await bcrypt.compare(password, usuarioExistente.password);

        if (!esCorrecto) {
            return res.status(400).json({ mensaje: 'Credenciales incorrectas' });
        }

        // 🔹 **Crear el payload del token**
        const payload = { id: usuarioExistente.id, rol: usuarioExistente.rol };

        // 🔹 **Generar el token JWT**
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

        // 🔹 **Devolver el token y los datos del usuario**
        res.json({
            token,
            user: {
                id: usuarioExistente._id,
                nombre: usuarioExistente.nombre,
                rol: usuarioExistente.rol,
                telefono: usuarioExistente.telefono,
                email: usuarioExistente.email || '',
                domicilio: usuarioExistente.domicilio || '',
                farmacia: usuarioExistente.farmacia || null
            }
        });

    } catch (error) {
        console.error('❌ Error en iniciarSesion:', error);
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
};

// obtener datos de usuario autenticado
exports.datosUsuarioAutenticado = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuario.id).select("-password"); // Excluimos el password
        if (!usuario) {
            return res.status(404).json({ mensaje: "Usuario no encontrado" });
        }
        res.json({ usuario });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al obtener datos del usuario", error });
    }
};


// usuario autenticado actualiza sus propios datos
exports.actualizarDatosUsuarioAutenticado = async (req, res) => {
    try {
        const { usuario, nombre, email, domicilio, telefono, password } = req.body;

        if (!usuario || !password || password.trim() === "") {
            return res.status(400).json({ mensaje: "Usuario y contraseña son obligatorios" });
        }

        const userFound = await Usuario.findById(req.usuario.id);

        if (!userFound) {
            return res.status(404).json({ mensaje: "Usuario no encontrado" });
        }

        const isMatch = await bcrypt.compare(password, userFound.password);
        if (!isMatch) {
            return res.status(401).json({ mensaje: "Credenciales incorrectas" });
        }

        // Verificar si el nuevo nombre de usuario ya está en uso por otro
        if (usuario !== userFound.usuario) {
            const usuarioExistente = await Usuario.findOne({ usuario });
            if (usuarioExistente && usuarioExistente._id.toString() !== userFound._id.toString()) {
                return res.status(400).json({ mensaje: "El nombre de usuario ya está en uso" });
            }
            userFound.usuario = usuario;
        }

        // Verificar si el nuevo teléfono ya está en uso por otro
        if (telefono && telefono !== userFound.telefono) {
            const telefonoExistente = await Usuario.findOne({ telefono });
            if (telefonoExistente && telefonoExistente._id.toString() !== userFound._id.toString()) {
                return res.status(400).json({ mensaje: "El teléfono ya está registrado por otro usuario" });
            }
            userFound.telefono = telefono;
        }

        userFound.nombre = nombre || userFound.nombre;
        userFound.email = email || userFound.email;
        userFound.domicilio = domicilio || userFound.domicilio;

        await userFound.save();

        res.json({
            mensaje: "Datos actualizados correctamente",
            usuario: {
                id: userFound._id,
                usuario: userFound.usuario,
                nombre: userFound.nombre,
                rol: userFound.rol,
                email: userFound.email,
                telefono: userFound.telefono,
                domicilio: userFound.domicilio
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al actualizar datos" });
    }
};


// usuario autenticado cambio su contraseña
exports.cambioContrasenia = async (req, res) => {
    try {
        const { usuario, passwordActual, nuevaPassword, confirmarPassword } = req.body;

        if (!usuario || !passwordActual || !nuevaPassword || !confirmarPassword) {
            return res.status(400).json({ mensaje: "Todos los campos son obligatorios" });
        }

        const usuarioFound = await Usuario.findOne({ usuario });
        if (!usuarioFound) {
            return res.status(404).json({ mensaje: "Usuario no encontrado" });
        }

        const passValido = await bcrypt.compare(passwordActual, usuarioFound.password);
        if (!passValido) {
            return res.status(400).json({ mensaje: "Credenciales incorrectas" });
        }

        if (nuevaPassword.length < 6) {
            return res.status(400).json({ mensaje: "La nueva contraseña debe tener al menos 6 caracteres" });
        }

        if (nuevaPassword !== confirmarPassword) {
            return res.status(400).json({ mensaje: "Las contraseñas nuevas no coinciden" });
        }

        const salt = await bcrypt.genSalt(10);
        usuarioFound.password = await bcrypt.hash(nuevaPassword, salt);
        await usuarioFound.save();

        res.json({ mensaje: "Contraseña actualizada correctamente" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al cambiar la contraseña" });
    }
};


// ruta protegida
exports.rutaProtegida = (req, res) => {
    res.json({ mensaje: "Ruta protegida de autenticación" });
};

/* exports.autoRegistroCliente = async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
        return res.status(400).json({ errores: errores.array() });
    }

    const { nombre, telefono, email, password, domicilio } = req.body;

    // 🔹 Validación manual del teléfono
    const telefonoRegex = /^\d{10}$/;
    if (!telefonoRegex.test(telefono)) {
        return res.status(400).json({ mensaje: "El teléfono debe contener exactamente 10 dígitos numéricos." });
    }

    try {
        // 🔹 Verificar si el teléfono ya está registrado
        let usuarioExistente = await Usuario.findOne({ telefono });

        if (usuarioExistente) {
            return res.status(400).json({ mensaje: 'El teléfono ya está registrado.' });
        }


        // 🔹 Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        const usuario = new Usuario({ nombre, telefono, email, password: hashedPassword, domicilio, rol: 'cliente', historialCompras: [] });
        await usuario.save();
        // Generar token automático para el usuario registrado
        const token = jwt.sign(
            { id: usuario._id, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.status(201).json({ mensaje: "Registro exitoso", token, usuario });
    } catch (error) {
        console.error('❌ Error interno al registrar usuario:', error);
        res.status(500).json({ mensaje: "Error al registrar usuario" });
    }
} */


