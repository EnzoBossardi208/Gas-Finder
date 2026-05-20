// ==================== DADOS DOS POSTOS ====================
// Postos com coordenadas GPS precisas para links do Google Maps

const POSTOS_DATA = {
  "Vera Cruz": [
    {
      id: "vc-001",
      name: "Posto RJ CHARRUA",
      brand: "Ipiranga",
      address: "R. Ernesto Wild, 330 - Centro, Vera Cruz - RS, 96880-000",
      lat: -29.7123762,
      lng: -52.5035573,
      customMapsLink: "https://maps.app.goo.gl/my8aZrMCkHHLbrNX8",
      gasolinaComum: 5.49,
      gasolinaAditivada: 5.79,
      etanol: 3.89,
      diesel: 4.99,
      dieselS10: 5.10,
      hasPromotion: true,
      promotionFuel: "gasolinaComum",
      promoPrice: 5.29,
      promoValidity: "--",
      openingHours: "06:00 – 20:40",
      phone: "(51) 3718-4026"
    },
    {
      id: "vc-002",
      name: "Posto Central",
      brand: "Bandeira Branca",
      address: "R. Roberto Gruendling, 81 - Centro, Vera Cruz - RS, 96880-000",
      lat: -29.716992,
      lng: -52.5015172,
      customMapsLink: "https://maps.app.goo.gl/FB5DMwVfNJ5HnrLU9",
      gasolinaComum: 5.39,
      gasolinaAditivada: 5.69,
      etanol: 3.79,
      diesel: 5.09,
      dieselS10: 5.19,
      hasPromotion: false,
      openingHours: "07:00 - 21:00",
      phone: "(51) 3718-2150"
    },
    {
      id: "vc-003",
      name: "Posto do Icó – Theisen & Hickmann",
      brand: "Petrobras",
      address: "R. Roberto Gruendling, 439 - Centro, Vera Cruz - RS, 96880-000",
      lat: -29.7178905,
      lng: -52.4972841,
      customMapsLink: "https://maps.app.goo.gl/gZ78Vvh7PiFjmPP17",
      gasolinaComum: 5.59,
      gasolinaAditivada: 5.89,
      etanol: 3.99,
      diesel: 5.19,
      dieselS10: 5.29,
      hasPromotion: true,
      promotionFuel: "etanol",
      promoPrice: 3.69,
      promoValidity: "21:00",
      openingHours: "07:00 – 23:00",
      phone: "(51) 3718 - 1658"
    },
    {
      id: "vc-004",
      name: "Posto Ipiranga",
      brand: "Ipiranga",
      address: "AR. Cláudio Manoel, 325 - Centro, Vera Cruz - RS, 96880-000",
      lat: -29.7168651,
      lng: -52.5077723,
      customMapsLink: "https://maps.app.goo.gl/gMppbNiqcTgFMn8cA",
      gasolinaComum: 5.45,
      gasolinaAditivada: 5.75,
      etanol: 3.85,
      diesel: 4.95,
      dieselS10: 5.05,
      hasPromotion: false,
      openingHours: "06:00 – 22:00",
      phone: "(51) 3718-1851"
    },
    {
      id: "vc-005",
      name: "Roselei H. Theisen & Cia",
      brand: "Bandeira Branca",
      address: "R. Intendente Koelzer, 454 - Centro, Vera Cruz - RS, 96880-000",
      lat: -29.7182047,
      lng: -52.5147745,
      customMapsLink: "https://maps.app.goo.gl/buHfkx9CzTqYddFZ6",
      gasolinaComum: 5.55,
      gasolinaAditivada: 5.85,
      etanol: 3.95,
      diesel: 5.05,
      dieselS10: 5.15,
      hasPromotion: true,
      promotionFuel: "gasolinaAditivada",
      promoPrice: 5.55,
      promoValidity: "20:00",
      openingHours: "06:30 – 21:30",
      phone: "Ausente"
    },
    {
      id: "vc-006",
      name: "Postos Central Santa Lúcia Vera Cruz",
      brand: "Posto de combustível",
      address: "Arco Íris, Vera Cruz - RS, 96880-000",
      lat: -29.7182047,
      lng: -52.5147745,
      customMapsLink: "https://maps.app.goo.gl/buHfkx9CzTqYddFZ6",
      gasolinaComum: 5.55,
      gasolinaAditivada: 5.85,
      etanol: 3.95,
      diesel: 5.05,
      dieselS10: 5.15,
      hasPromotion: true,
      promotionFuel: "gasolinaAditivada",
      promoPrice: 5.55,
      promoValidity: "20:00",
      openingHours: "06:30 – 21:30",
      phone: "Ausente"
    },

  ],
  "Santa Cruz do Sul": [
    {
      id: "scs-001",
      name: "Posto Nevoeiro – Senai",
      brand: "Shell",
      address: "Rua Senador Pinheiro Machado, 1367 – SENAI, Santa Cruz do Sul – RS",
      lat: -29.73253,
      lng: -52.42882,
      gasolinaComum: 5.98,
      gasolinaAditivada: 6.19,
      etanol: 4.19,
      diesel: 5.29,
      dieselS10: 5.39,
      hasPromotion: true,
      promotionFuel: "gasolinaComum",
      promoPrice: 5.79,
      promoValidity: "23:00",
      openingHours: "06:00 – 22:00",
      phone: "(51) 3711-0001"
    },
    {
      id: "scs-002",
      name: "Posto Nevoeiro – Matriz",
      brand: "Shell",
      address: "Rua Senador Pinheiro Machado, 748 – Centro, Santa Cruz do Sul – RS",
      lat: -29.72204,
      lng: -52.43052,
      gasolinaComum: 6.10,
      gasolinaAditivada: 6.29,
      etanol: 4.29,
      diesel: 5.39,
      dieselS10: 5.49,
      hasPromotion: false,
      openingHours: "06:00 – 21:00",
      phone: "(51) 3711-0002"
    },
    {
      id: "scs-003",
      name: "Posto Buffon – Branca",
      brand: "Bandeira Branca",
      address: "Rua Joaquim Murtinho, 751 – Bonfim, Santa Cruz do Sul – RS",
      lat: -29.70503,
      lng: -52.41002,
      gasolinaComum: 6.05,
      gasolinaAditivada: 6.25,
      etanol: 4.25,
      diesel: 5.35,
      dieselS10: 5.45,
      hasPromotion: true,
      promotionFuel: "gasolinaComum",
      promoPrice: 5.85,
      promoValidity: "22:30",
      openingHours: "06:00 – 22:00",
      phone: "(51) 3711-0003"
    },
    {
      id: "scs-004",
      name: "Posto Buffon – B82",
      brand: "Bandeira Branca",
      address: "Rua Vinte e Oito de Setembro, 1848 – Goiás, Santa Cruz do Sul – RS",
      lat: -29.73498,
      lng: -52.44001,
      gasolinaComum: 6.05,
      gasolinaAditivada: 6.25,
      etanol: 4.25,
      diesel: 5.35,
      dieselS10: 5.45,
      hasPromotion: false,
      openingHours: "06:00 – 22:00",
      phone: "(51) 3711-0004"
    },
    {
      id: "scs-005",
      name: "Posto Nevoeiro – Tapuia",
      brand: "Shell",
      address: "Rua Marechal Floriano, 170 – Centro, Santa Cruz do Sul – RS",
      lat: -29.71797,
      lng: -52.42002,
      gasolinaComum: 6.10,
      gasolinaAditivada: 6.29,
      etanol: 4.29,
      diesel: 5.39,
      dieselS10: 5.49,
      hasPromotion: true,
      promotionFuel: "gasolinaAditivada",
      promoPrice: 5.99,
      promoValidity: "21:30",
      openingHours: "06:00 – 23:00",
      phone: "(51) 3711-0005"
    },
    {
      id: "scs-006",
      name: "Posto Ipiranga – Senador",
      brand: "Ipiranga",
      address: "Rua Senador Pinheiro Machado, 1010 – Centro, Santa Cruz do Sul – RS",
      lat: -29.72503,
      lng: -52.40503,
      gasolinaComum: 6.15,
      gasolinaAditivada: 6.35,
      etanol: 4.35,
      diesel: 5.45,
      dieselS10: 5.55,
      hasPromotion: false,
      openingHours: "06:30 – 22:30",
      phone: "(51) 3711-0006"
    },
    {
      id: "scs-007",
      name: "Posto Três Coqueiros",
      brand: "Shell",
      address: "Av. Presidente Castelo Branco, 64 – Dist. Industrial, Santa Cruz do Sul – RS",
      lat: -29.70002,
      lng: -52.45003,
      gasolinaComum: 6.20,
      gasolinaAditivada: 6.40,
      etanol: 4.40,
      diesel: 5.50,
      dieselS10: 5.60,
      hasPromotion: true,
      promotionFuel: "etanol",
      promoPrice: 4.09,
      promoValidity: "22:00",
      openingHours: "06:00 – 23:00",
      phone: "(51) 3711-0007"
    },
    {
      id: "scs-008",
      name: "Posto Batalhão",
      brand: "Bandeira Branca",
      address: "Av. Deputado Euclydes N. Kliemann, 130 – Faxinal Velho, Santa Cruz do Sul – RS",
      lat: -29.69002,
      lng: -52.40002,
      gasolinaComum: 5.95,
      gasolinaAditivada: 6.15,
      etanol: 4.15,
      diesel: 5.25,
      dieselS10: 5.35,
      hasPromotion: false,
      openingHours: "24h",
      phone: "(51) 3711-0008"
    },
    {
      id: "scs-009",
      name: "Posto 28",
      brand: "Bandeira Branca",
      address: "Rua São José, 1449 – Centro, Santa Cruz do Sul – RS",
      lat: -29.71002,
      lng: -52.46002,
      gasolinaComum: 6.25,
      gasolinaAditivada: 6.45,
      etanol: 4.45,
      diesel: 5.55,
      dieselS10: 5.65,
      hasPromotion: true,
      promotionFuel: "gasolinaComum",
      promoPrice: 6.05,
      promoValidity: "23:30",
      openingHours: "06:00 – 22:00",
      phone: "(51) 3711-0009"
    },
    {
      id: "scs-010",
      name: "Posto Shopping Car",
      brand: "Bandeira Branca",
      address: "Rua Carlos Trein Filho, 1343 – Centro, Santa Cruz do Sul – RS",
      lat: -29.72301,
      lng: -52.43503,
      gasolinaComum: 6.18,
      gasolinaAditivada: 6.38,
      etanol: 4.38,
      diesel: 5.48,
      dieselS10: 5.58,
      hasPromotion: false,
      openingHours: "06:30 – 21:00",
      phone: "(51) 3711-0010"
    },
    {
      id: "scs-011",
      name: "Posto Morales H24",
      brand: "Petrobras",
      address: "Rua Carlos Maurício Werlang, 187 – Santo Inácio, Santa Cruz do Sul – RS",
      lat: -29.72803,
      lng: -52.41801,
      gasolinaComum: 6.22,
      gasolinaAditivada: 6.42,
      etanol: 4.42,
      diesel: 5.52,
      dieselS10: 5.62,
      hasPromotion: true,
      promotionFuel: "gasolinaAditivada",
      promoPrice: 6.12,
      promoValidity: "22:00",
      openingHours: "24h",
      phone: "(51) 3711-0011"
    },
    {
      id: "scs-012",
      name: "Posto do Galo",
      brand: "Bandeira Branca",
      address: "Rua Gaspar Silveira Martins, 1500 – Centro, Santa Cruz do Sul – RS",
      lat: -29.71601,
      lng: -52.41202,
      gasolinaComum: 6.08,
      gasolinaAditivada: 6.28,
      etanol: 4.28,
      diesel: 5.38,
      dieselS10: 5.48,
      hasPromotion: false,
      openingHours: "06:00 – 22:00",
      phone: "(51) 3711-0012"
    },
    {
      id: "scs-013",
      name: "Posto Central",
      brand: "Ipiranga",
      address: "Travessa Vinicius de Moraes, 387 – Centro, Santa Cruz do Sul – RS",
      lat: -29.72002,
      lng: -52.42503,
      gasolinaComum: 6.12,
      gasolinaAditivada: 6.32,
      etanol: 4.32,
      diesel: 5.42,
      dieselS10: 5.52,
      hasPromotion: true,
      promotionFuel: "etanol",
      promoPrice: 4.02,
      promoValidity: "21:00",
      openingHours: "06:00 – 23:00",
      phone: "(51) 3711-0013"
    }
  ]
};

// Gera o link do Google Maps (link personalizado PRIORIDADE, depois coordenadas)
function getMapsLink(posto) {
  // 1ª opção: link personalizado do Maps
  if (posto.customMapsLink && posto.customMapsLink.trim() !== '') {
    return posto.customMapsLink;
  }
  // 2ª opção: coordenadas (lat e lng)
  if (posto.lat !== undefined && posto.lng !== undefined) {
    return `https://www.google.com/maps?q=${posto.lat},${posto.lng}&zoom=17`;
  }
  // Se não tiver nenhum, retorna vazio (botão será ocultado)
  return '';
}

// Gera o link de navegação (link personalizado PRIORIDADE, depois coordenadas)
function getDirectionsLink(posto) {
  // 1ª opção: link personalizado de rota
  if (posto.customDirectionsLink && posto.customDirectionsLink.trim() !== '') {
    return posto.customDirectionsLink;
  }
  // 2ª opção: coordenadas (lat e lng)
  if (posto.lat !== undefined && posto.lng !== undefined) {
    return `https://www.google.com/maps/dir/?api=1&destination=${posto.lat},${posto.lng}&travelmode=driving`;
  }
  // Se não tiver nenhum, retorna vazio (botão será ocultado)
  return '';
}

// Retorna todos os postos de uma cidade, com IDs e links já gerados
function getPostosPorCidade(cidade) {
  const lista = POSTOS_DATA[cidade] || [];
  return lista.map(p => ({
    ...p,
    city: cidade,
    mapsLink: getMapsLink(p),
    directionsLink: getDirectionsLink(p)
  }));
}

// Todas as cidades disponíveis
const CIDADES_DISPONIVEIS = ["Vera Cruz", "Santa Cruz do Sul"];