const mongoose = require("mongoose");

const CancelacionSchema = new mongoose.Schema({
  pedido: { type: mongoose.Schema.Types.ObjectId, ref: "Pedido", required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
  farmacia: { type: mongoose.Schema.Types.ObjectId, ref: "Farmacia", required: true },
  dineroDevuelto: { type: Number, required: true },
  valeDevuelto: { type: Number, required: true },
  totalDevuelto: { type: Number, required: true },
  fechaCancelacion: { type: Date },
}, { collection: 'cancelaciones' });

module.exports = mongoose.model("Cancelacion", CancelacionSchema);
