type SearchableProduct = {
    codigo: string;
    nombre: string;
};

const normalizeSearchText = (value: string): string => value.toLowerCase().trim();

const getProductSearchScore = (code: string, name: string, query: string): number => {
    if (code === query) return 500;
    if (code.startsWith(query)) return 400;
    if (name.startsWith(query)) return 300;
    if (code.includes(query)) return 200;
    if (name.includes(query)) return 100;
    return 0;
};

export const searchProducts = <T extends SearchableProduct>(
    products: T[],
    rawQuery: string,
    limit = 100,
): T[] => {
    const query = normalizeSearchText(rawQuery);
    if (!query) return products.slice(0, limit);

    return products
        .map((product, index) => {
            const code = normalizeSearchText(String(product.codigo ?? ""));
            const name = normalizeSearchText(String(product.nombre ?? ""));
            const score = getProductSearchScore(code, name, query);

            if (score === 0) return null;

            return {
                product,
                index,
                score,
                codeLength: code.length,
            };
        })
        .filter((item): item is { product: T; index: number; score: number; codeLength: number } => item !== null)
        .sort((a, b) =>
            b.score - a.score ||
            a.codeLength - b.codeLength ||
            a.index - b.index
        )
        .slice(0, limit)
        .map(({ product }) => product);
};
