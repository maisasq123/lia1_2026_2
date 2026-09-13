# 🏠 Análise do Mercado de Aluguéis de Imóveis em São Paulo

## 🎯 Objetivo

Este projeto tem como objetivo analisar um conjunto de dados de imóveis para aluguel em São Paulo, buscando identificar quais características dos imóveis apresentam maior relação com o valor do aluguel.

A análise considera aspectos estruturais, como área, número de quartos e vagas de garagem, além do tipo de imóvel e da localização.

---

## 🔎 Perguntas de pesquisa

1. 📐 A área do imóvel influencia o valor do aluguel?
2. 🛏️ O número de quartos influencia o preço?
3. 📍 A localização influencia o valor do aluguel?
4. 🚗 Imóveis com mais vagas de garagem apresentam aluguéis maiores?
5. 🏠 O tipo de imóvel influencia o valor do aluguel?
6. 💰 Quais características apresentam maior relação com o valor do aluguel?
7. 🤖 É possível utilizar regressão linear para estimar o aluguel de um imóvel?

---

## 📊 Dataset

O conjunto de dados contém **11.657 imóveis** e **8 variáveis**:

| Variável | Descrição |
|---|---|
| `address` | Endereço do imóvel |
| `district` | Bairro |
| `area` | Área do imóvel em m² |
| `bedrooms` | Número de quartos |
| `garage` | Número de vagas de garagem |
| `type` | Tipo de imóvel |
| `rent` | Valor do aluguel |
| `total` | Valor total informado no anúncio |

Os dados foram armazenados na pasta `dados` do projeto.

---

## 🧹 Tratamento dos dados

Inicialmente foi realizada uma exploração da estrutura do dataset, verificando:

- tipos das variáveis;
- valores ausentes;
- registros duplicados;
- estatísticas descritivas;
- tipos de imóveis;
- possíveis inconsistências nos valores.

Também foram verificadas situações como:

- imóveis com área menor ou igual a zero;
- aluguéis menores ou iguais a zero;
- valores totais inferiores ao valor do aluguel.

Na etapa de limpeza, foram removidos os registros com área menor ou igual a zero.

---

## 📈 Análise exploratória

Foram analisadas as relações entre as principais características dos imóveis e o valor do aluguel.

### Área e aluguel

A área apresentou correlação de **0,667** com o valor do aluguel, sendo a variável numérica com maior correlação entre as analisadas.

Esse resultado indica uma relação positiva: em geral, imóveis maiores tendem a apresentar aluguéis maiores.

### Garagem e aluguel

O número de vagas de garagem apresentou correlação de **0,617** com o aluguel.

O aluguel médio aumentou conforme o número de vagas:

| Vagas | Aluguel médio |
|---:|---:|
| 0 | R$ 1.847,75 |
| 1 | R$ 2.915,28 |
| 2 | R$ 4.741,68 |
| 3 | R$ 6.813,90 |
| 4 | R$ 7.985,31 |
| 5 | R$ 8.422,54 |
| 6 | R$ 8.563,28 |

Apesar da tendência, a existência de correlação não significa que a garagem, isoladamente, seja responsável pelo aumento do aluguel.

### Quartos e aluguel

O número de quartos apresentou correlação de **0,531** com o valor do aluguel.

Assim como ocorre com área e garagem, imóveis com maior quantidade de quartos tendem a apresentar valores de aluguel mais elevados.

---

## 🏠 Tipo de imóvel

Foram identificados quatro principais tipos de imóveis:

- Casa
- Casa em condomínio
- Apartamento
- Studio e kitnet

O aluguel médio encontrado foi:

| Tipo | Aluguel médio |
|---|---:|
| Casa em condomínio | R$ 3.912,55 |
| Casa | R$ 3.472,02 |
| Apartamento | R$ 3.357,15 |
| Studio e kitnet | R$ 2.127,83 |

Entretanto, quando analisado o aluguel proporcional à área, o resultado muda:

| Tipo | Aluguel médio por m² |
|---|---:|
| Studio e kitnet | R$ 72,74/m² |
| Casa em condomínio | R$ 68,29/m² |
| Apartamento | R$ 48,47/m² |
| Casa | R$ 27,70/m² |

Isso mostra a importância de analisar tanto o valor absoluto do aluguel quanto o valor proporcional à área.

---

## 📍 Localização

A análise dos bairros mostrou diferenças expressivas nos valores médios de aluguel.

Os imóveis foram agrupados por bairro para identificar regiões com diferentes padrões de preço.

Essa análise permite observar que o valor do aluguel não depende apenas das características físicas do imóvel, mas também de sua localização.

---

## 🔗 Análise combinada

As variáveis estruturais apresentam relações entre si.

As principais correlações observadas foram:

- Área × Quartos: **0,728**
- Área × Garagem: **0,734**
- Quartos × Garagem: **0,657**

Isso significa que imóveis maiores tendem também a possuir mais quartos e mais vagas de garagem.

Portanto, não é adequado interpretar a correlação de cada variável com o aluguel como se cada característica atuasse de forma completamente independente.

---

## 🤖 Regressão linear

Foi desenvolvida uma regressão linear com o objetivo de estimar o valor do aluguel a partir das características dos imóveis.

Foram avaliados dois modelos.

### Modelo 1

O primeiro modelo utilizou características numéricas do imóvel, como:

- área;
- número de quartos;
- número de vagas de garagem.

### Modelo 2

O segundo modelo incorporou também variáveis categóricas relacionadas ao:

- tipo de imóvel;
- bairro/localização.

As variáveis categóricas foram transformadas em variáveis numéricas utilizando **One-Hot Encoding**, permitindo que fossem utilizadas pelo modelo de regressão.

### Comparação dos modelos

O segundo modelo apresentou desempenho superior ao primeiro.

**Modelo 2:**

- **R² = 0,667**
- **MAE = R$ 1.005,91**
- **RMSE = R$ 1.537,59**

O R² de 0,667 indica que o modelo consegue explicar aproximadamente **66,7% da variação observada nos valores de aluguel** a partir das variáveis utilizadas.

O MAE indica que, em média, as previsões do modelo apresentam um erro absoluto de aproximadamente **R$ 1.005,91**.

A inclusão do tipo de imóvel e da localização melhorou a capacidade preditiva do modelo, indicando que essas características possuem informação relevante para estimar o valor do aluguel.

---

## 🏡 Aplicação prática

O segundo modelo também foi utilizado para realizar uma estimativa de aluguel para um imóvel hipotético.

Exemplo utilizado na análise:

- 📍 Bairro: Bela Vista
- 🏠 Tipo: Apartamento
- 📐 Área: 80 m²
- 🛏️ Quartos: 2
- 🚗 Garagem: 1 vaga

O modelo estimou um aluguel de aproximadamente:

**R$ 3.103,06**

Essa previsão representa uma estimativa estatística baseada nos dados disponíveis e não deve ser interpretada como uma determinação exata do preço de mercado.

---

## 🏆 Conclusões

A análise dos 11.657 imóveis mostrou que o valor do aluguel está associado a uma combinação de características estruturais e locacionais.

Entre as variáveis numéricas analisadas, a **área** apresentou a maior correlação com o aluguel (**0,667**), seguida pela **garagem (0,617)** e pelos **quartos (0,531)**.

Também foram observadas diferenças importantes entre os tipos de imóveis e entre os bairros.

Casas em condomínio apresentaram o maior aluguel médio, enquanto studios e kitnets apresentaram o menor aluguel mensal. Por outro lado, studios e kitnets apresentaram o maior aluguel médio por metro quadrado.

A análise de regressão mostrou que a utilização conjunta das características dos imóveis, incluindo tipo e localização, permite obter estimativas mais adequadas do valor do aluguel.

### 💡 Principal conclusão

> **O valor do aluguel parece resultar da combinação entre tamanho, estrutura, tipo de imóvel e localização, e não de uma única característica isolada.**

---

## 💡 Recomendações

- 🏠 **Para quem procura um imóvel:** comparar apenas o aluguel mensal pode ser insuficiente. O preço por metro quadrado pode ajudar na comparação entre imóveis de diferentes tamanhos.

- 📐 **Para proprietários:** área, quartos, vagas, tipo de imóvel e localização devem ser considerados conjuntamente na definição de um preço.

- 📍 **Para análise de mercado:** a localização deve ser considerada, pois diferentes bairros apresentam padrões de preço distintos.

- 💰 **Para comparação de imóveis:** recomenda-se analisar tanto o aluguel total quanto o aluguel por metro quadrado.

- 🤖 **Para estimativas:** modelos estatísticos podem auxiliar na previsão de preços, mas suas estimativas dependem das variáveis disponíveis no conjunto de dados.

---

## 🛠️ Tecnologias utilizadas

- Python
- Pandas
- NumPy
- Matplotlib
- Seaborn
- Scikit-learn
- Google Colab
- GitHub

---

## 📁 Estrutura do projeto

```text
Analise_Alugueis/
│
├── dados/
│   └── dados.csv
│
├── Analise_Alugueis_Sao_Paulo.ipynb
│
└── README.md
