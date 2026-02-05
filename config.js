export const DEFAULTS = {
  economy: {
    currencySymbol: "R$",
    currencyName: "Reais",
    startingWallet: 0,
    startingBank: 0,
    daily: { amount: 250, cooldownHours: 20 },
    work: { min: 80, max: 220, cooldownMinutes: 30 },
    maxBalance: 999_999_999,
    transferTaxPct: 0,
  },

  casino: {
    minBet: 10,
    maxBet: 50_000,
    houseEdgePct: 2,
    cooldownSeconds: 3,

    blackjack: { payoutBlackjack: 1.5, payoutWin: 1.0 },
    cockfight: { baseWinChancePct: 50, winBonusPct: 10, losePenaltyPct: 6 },
    truco: { defaultMode: "paulista" },
  }
};

