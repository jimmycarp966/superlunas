import { Settings, Plan } from "./types";
import { supabase } from "./supabase";

const defaultSettings: Settings = {
    redondeoTotal: 2,
    redondeoCuota: 2,
    listas: ["local", "valles"],
    listaLabels: {
        local: "(Catamarca / T. Ralo)",
        valles: "(Catamarca / Valles)",
    },
    listaMarkups: {
        valles: 5,
    },
};

const defaultPlans: Plan[] = [
    { id: "1", nombre: "Plan Contado", semanas: 0, tasaPorcentaje: 0, activo: true, orden: 1 },
    { id: "2", nombre: "12 Semanas", semanas: 12, tasaPorcentaje: 25, activo: true, orden: 2 },
    { id: "3", nombre: "16 Semanas", semanas: 16, tasaPorcentaje: 40, activo: true, orden: 3, badge: "Promoción" },
];

const rowToSettings = (row: Record<string, unknown>): Settings => ({
    redondeoTotal: (row.redondeo_total as 0 | 2) ?? defaultSettings.redondeoTotal,
    redondeoCuota: (row.redondeo_cuota as 0 | 2) ?? defaultSettings.redondeoCuota,
    listas: (row.listas as string[]) ?? defaultSettings.listas,
    listaLabels: (row.lista_labels as Record<string, string>) ?? defaultSettings.listaLabels,
    listaMarkups: (row.lista_markups as Record<string, number>) ?? defaultSettings.listaMarkups,
});

const settingsToRow = (s: Settings) => ({
    id: 1,
    redondeo_total: s.redondeoTotal,
    redondeo_cuota: s.redondeoCuota,
    listas: s.listas,
    lista_labels: s.listaLabels ?? {},
    lista_markups: s.listaMarkups ?? {},
});

const rowToPlan = (row: Record<string, unknown>): Plan => ({
    id: String(row.id),
    nombre: String(row.nombre),
    semanas: Number(row.semanas),
    tasaPorcentaje: Number(row.tasa_porcentaje),
    activo: Boolean(row.activo),
    orden: Number(row.orden),
    badge: row.badge ? String(row.badge) : undefined,
});

const planToRow = (p: Plan) => ({
    id: p.id,
    nombre: p.nombre,
    semanas: p.semanas,
    tasa_porcentaje: p.tasaPorcentaje,
    activo: p.activo,
    orden: p.orden,
    badge: p.badge ?? null,
});

export const getSettings = async (): Promise<Settings> => {
    const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .single();

    if (error) throw new Error(`Error leyendo app_settings en Supabase: ${error.message}`);
    if (!data) throw new Error("No existe app_settings.id=1 en Supabase");

    return rowToSettings(data as Record<string, unknown>);
};

export const updateSettings = async (newSettings: Partial<Settings>): Promise<Settings> => {
    const current = await getSettings();
    const updated: Settings = { ...current, ...newSettings };

    await supabase
        .from("app_settings")
        .upsert(settingsToRow(updated));

    return updated;
};

export const getPlans = async (): Promise<Plan[]> => {
    const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("orden", { ascending: true });

    if (error) throw new Error(`Error leyendo plans en Supabase: ${error.message}`);
    if (!data || data.length === 0) throw new Error("La tabla plans en Supabase no tiene registros");

    return (data as Record<string, unknown>[]).map(rowToPlan);
};

export const updatePlans = async (newPlans: Plan[]): Promise<Plan[]> => {
    const { error: deleteError } = await supabase.from("plans").delete().neq("id", "");
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await supabase.from("plans").insert(newPlans.map(planToRow));
    if (insertError) throw new Error(insertError.message);

    return [...newPlans];
};
