import { Settings, Plan } from "./types";

declare global {
    var appSettings: Settings | undefined;
    var appPlans: Plan[] | undefined;
}

const defaultSettings: Settings = {
    redondeoTotal: 2,
    redondeoCuota: 2,
    listas: ["local", "valles"],
    listaLabels: {
        local: "(Catamarca / T. Ralo)",
        valles: "(Catamarca / Valles)",
    },
};

const defaultPlans: Plan[] = [
    { id: "1", nombre: "Plan Contado", semanas: 0, tasaPorcentaje: 0, activo: true, orden: 1 },
    { id: "2", nombre: "12 Semanas", semanas: 12, tasaPorcentaje: 25, activo: true, orden: 2 },
    { id: "3", nombre: "16 Semanas", semanas: 16, tasaPorcentaje: 40, activo: true, orden: 3, badge: "Promoción" },
];

export const getSettings = (): Settings => {
    if (!global.appSettings) global.appSettings = { ...defaultSettings };
    return global.appSettings;
};

export const updateSettings = (newSettings: Partial<Settings>): Settings => {
    const current = getSettings();
    global.appSettings = { ...current, ...newSettings };
    return global.appSettings;
};

export const getPlans = (): Plan[] => {
    if (!global.appPlans) global.appPlans = [...defaultPlans];
    return global.appPlans;
};

export const updatePlans = (newPlans: Plan[]): Plan[] => {
    global.appPlans = [...newPlans];
    return global.appPlans;
};
