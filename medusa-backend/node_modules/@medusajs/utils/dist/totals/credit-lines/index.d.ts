import { BigNumberInput } from "@medusajs/types";
export declare function calculateCreditLinesTotal({ creditLines, includesTax, taxRate, currencyCode, }: {
    creditLines: {
        amount: BigNumberInput;
    }[];
    includesTax?: boolean;
    taxRate?: BigNumberInput;
    currencyCode?: string;
}): {
    creditLinesTotal: globalThis.BigNumber;
    creditLinesSubtotal: globalThis.BigNumber;
    creditLinesTaxTotal: globalThis.BigNumber;
};
//# sourceMappingURL=index.d.ts.map