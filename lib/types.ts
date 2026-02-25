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
