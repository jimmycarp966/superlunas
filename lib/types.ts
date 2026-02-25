export interface Product {
    codigo: string;
    nombre: string;
    precio: number;
    stock: number;
    lista: string; // Ej: 'local', 'valles'
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
}
