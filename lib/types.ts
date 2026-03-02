export interface Product {
    codigo: string;
    nombre: string;
    precio: number;
    stock: number;
    lista: string; // Ej: 'local', 'valles'
    color?: string | null;
    tamano?: string | null;
    modelo?: string | null;
    garantiaMeses?: number | null;
    requiereSerie?: boolean;
    numeroSerie?: string | null;
    imagenUrl?: string | null;
}

export interface CatalogCache {
    data: Product[];
    updatedAt: number; // timestamp
    sourceVersion: string; // ej: hash o checksum del archivo
}

export interface Settings {
    redondeoTotal: 2 | 0;
    redondeoCuota: 2 | 0;
    listas: string[];
    listaLabels?: Record<string, string>;
    listaMarkups?: Record<string, number>; // % de recargo por lista, ej: { valles: 5 }
}

export interface Plan {
    id: string;
    nombre: string;
    semanas: number;
    tasaPorcentaje: number;
    activo: boolean;
    orden: number;
    badge?: string;
}

export interface Registration {
    id: string;
    fecha: string;
    vendedor: string;
    zona: string;
    cliente: string;
    nroCliente: string;
    dni: string;
    telefono: string;
    localidad: string;
    rubro: string;
    domCom: string;
    domPar: string;
    productos: string;
    planes: string;
    anticipo: string;
    total: string;
    conyugue: string;
    dniConyugue: string;
    telConyugue: string;
    observaciones: string;
}

export interface ClientRecord {
    nombre: string;
    dni: string;
    telefono: string;
    localidad: string;
    rubro: string;
    domCom: string;
    domPar: string;
    conyugue: string;
    dniConyugue: string;
    telConyugue: string;
    zona: string;
    nroCliente: string;
    observaciones?: string;
}

export interface Sucursal {
    id: string;
    nombre: string;
    codigo: string;
    esCasaCentral: boolean;
}

export interface Deposito {
    id: string;
    sucursalId: string;
    nombre: string;
    codigo: string;
}

export interface ZonaCobranza {
    id: string;
    nombre: string;
    codigo: string;
}

export type CreditoEstado =
    | "pendiente_auditoria"
    | "pendiente_encargado"
    | "pendiente_repartidor"
    | "aprobado"
    | "rechazado";

export interface CreditoSolicitud {
    id: string;
    cliente: string;
    dni: string;
    vendedor: string;
    zona: string;
    total: number;
    estado: CreditoEstado;
    informeComercialUrl?: string | null;
    observaciones?: string | null;
    creadoAt: string;
    actualizadoAt: string;
}

export interface CobranzaAgendaItem {
    id: string;
    cliente: string;
    dni: string;
    cobradorUsername: string;
    zona: string;
    fechaVencimiento: string;
    montoPendiente: number;
    cuotasRestantes: number;
    estado: "pendiente" | "pagado" | "vencido";
}

export interface ImputacionPagoInput {
    agendaId: string;
    monto: number;
    fechaImputacion: string;
    fechaDeudaObjetivo: string;
    observaciones?: string;
}

export interface TesoreriaMovimiento {
    id: string;
    sucursalId: string;
    cajaId: string;
    tipo: "ingreso" | "egreso";
    monto: number;
    concepto: string;
    medioPago: "efectivo" | "transferencia" | "debito" | "credito" | "otro";
    creadoAt: string;
}

export interface ProductVariant {
    id: string;
    productCodigo: string;
    color: string;
    tamano: string;
    modelo: string;
    precio?: number | null;
    stock?: number | null;
}

export interface ProductPhoto {
    id: string;
    productCodigo: string;
    url: string;
    isPrimary: boolean;
    orden: number;
}
