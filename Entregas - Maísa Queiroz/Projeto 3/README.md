# Image Classifier Pro (11)

Crie um aplicativo web simples e funcional para realizar inferência e classificação de imagens usando modelos no formato ONNX.

O objetivo é permitir que o usuário carregue um modelo ONNX, envie imagens e veja as classificações produzidas pelo modelo, com possibilidade de definir um nível mínimo de confiança.

1. Fluxo principal

O aplicativo deve funcionar em três etapas:

Carregar o modelo ONNX.

Configurar o nível mínimo de confiança.

Enviar uma ou várias imagens para realizar a inferência.

Após o processamento, o sistema deve apresentar os resultados de classificação de cada imagem.

2. Upload do modelo

Criar uma área para o usuário carregar um arquivo .onnx.

Após o upload:

Validar se o arquivo é realmente um modelo ONNX válido.

Exibir o nome do arquivo carregado.

Exibir um indicador de que o modelo está pronto para inferência.

Se houver erro ao carregar o modelo, mostrar uma mensagem clara para o usuário.

O aplicativo deve ser capaz de executar a inferência no próprio navegador sempre que tecnicamente possível, utilizando uma biblioteca apropriada para ONNX, como ONNX Runtime Web.

Não criar um backend complexo se ele não for necessário para o funcionamento do MVP.

2.1. Descrição do modelo

Após carregar o arquivo ONNX, disponibilizar um campo opcional chamado:

"Descrição do modelo"

Esse campo deve permitir que o usuário informe, de forma simples, o que aquele modelo faz.

Exemplo:

Modelo:
classificador_animais.onnx

Descrição:
Modelo utilizado para classificar imagens de animais em diferentes categorias.

A descrição deve aparecer junto às informações do modelo carregado, antes da área de classificação.

Exemplo de apresentação:

┌──────────────────────────────────────────┐
│ Modelo carregado │
│ │
│ classificador_animais.onnx │
│ │
│ Descrição │
│ Modelo para classificação de imagens │
│ de animais. │
└──────────────────────────────────────────┘

O campo deve ser opcional.

Também permitir que o usuário edite a descrição enquanto o modelo estiver carregado.

Se o arquivo ONNX possuir metadados de descrição/nome/versão, exibir essas informações separadamente quando disponíveis, mas não depender delas para preencher a descrição funcional do modelo.

Não é necessário criar banco de dados ou persistência das descrições neste MVP. A descrição pode permanecer apenas durante a sessão atual.

3. Nível de confiança

Adicionar um campo para definir o nível mínimo de confiança.

Por exemplo:

Confiança mínima: 80%

O usuário deve poder alterar esse valor, preferencialmente utilizando um slider de 0% a 100%.

A regra deve ser:

Se a confiança da classificação for maior ou igual ao threshold definido pelo usuário, mostrar a classificação.

Se a confiança for menor que o threshold, indicar que a imagem não atingiu o nível mínimo de confiança.

Exemplo:

Imagem: cachorro.jpg
Classificação: dog
Confiança: 94,7%
Resultado: aprovado

Imagem: animal.jpg
Classificação: cat
Confiança: 61,2%
Threshold: 80%
Resultado: confiança insuficiente

Importante: não esconder silenciosamente as imagens que não atingirem o threshold. Mostrar que elas foram processadas, mas não atingiram a confiança mínima.

4. Upload das imagens

Permitir que o usuário envie:

uma imagem;

ou várias imagens simultaneamente.

Aceitar formatos comuns, como:

JPG/JPEG

PNG

WEBP

Criar uma área de drag and drop para facilitar o upload.

Após o upload, mostrar uma prévia das imagens.

Adicionar um botão:

"Classificar imagens"

Enquanto a inferência estiver acontecendo, mostrar um indicador de processamento.

5. Resultados

Para cada imagem processada, mostrar um card contendo:

Preview da imagem;

Nome do arquivo;

Classe prevista;

Confiança em porcentagem;

Status em relação ao threshold.

Exemplo:

┌─────────────────────────┐
│ [imagem] │
│ │
│ arquivo: imagem01.jpg │
│ Classe: cachorro │
│ Confiança: 94,7% │
│ ✓ Acima do threshold │
└─────────────────────────┘

Se estiver abaixo do threshold:

Classe mais provável: cachorro
Confiança: 61,2%
⚠ Abaixo da confiança mínima de 80%

6. Tradução das classes

Adicionar uma opção para carregar um arquivo de tradução das classes.

Recomendo utilizar CSV.

Formato esperado:

original,traducao
cat,gato
dog,cachorro
car,carro

O sistema deve utilizar o valor retornado pelo modelo na coluna original e substituir pelo valor correspondente da coluna traducao.

Exemplo:

Modelo retorna:

dog — 94,7%

Com o arquivo de tradução carregado:

dog → cachorro

O resultado exibido será:

Cachorro — 94,7%

A tradução deve ser opcional. Se nenhum arquivo de tradução for carregado, mostrar a classe original retornada pelo modelo.

Também permitir que o usuário veja a classe original quando necessário.

7. Importante sobre o modelo ONNX

Não assumir que todos os modelos ONNX possuem exatamente a mesma estrutura de entrada e saída.

O aplicativo deve tentar identificar automaticamente:

formato da entrada;

dimensões esperadas;

tipo de dado;

formato da saída.

Sempre que possível, detectar automaticamente o tamanho esperado da imagem.

Caso o modelo exija uma configuração que não possa ser detectada automaticamente, mostrar uma configuração simples para o usuário informar os parâmetros necessários.

Não criar uma interface complexa para isso no MVP.

8. Interface

A interface deve ser simples, limpa e moderna.

Estrutura sugerida:

Título:

"ONNX Image Classifier"

Subtítulo:

"Carregue um modelo ONNX e classifique imagens diretamente no navegador."

Seção 1:
"1. Modelo ONNX"
[ Upload do modelo ]

Seção 2:
"2. Confiança mínima"
[ Slider 0% — 100% ]
"Mostrar classificações com confiança ≥ XX%"

Seção 3:
"3. Traduções — opcional"
[ Upload CSV ]

Seção 4:
"4. Imagens"
[ Área de drag and drop ]

[ Classificar imagens ]

Seção 5:
"Resultados"

[Cards das imagens processadas]

Adicionar também um botão:

"Limpar"

que reinicia a sessão atual.

9. Resumo dos resultados

No topo da área de resultados, mostrar:

Imagens processadas: 20
Classificações acima do threshold: 16
Abaixo do threshold: 4

Também mostrar, se possível:

Confiança média: XX%

10. Tratamento de erros

Criar mensagens claras para situações como:

modelo ONNX inválido;

formato de imagem não suportado;

erro durante a inferência;

modelo incompatível com o ambiente;

arquivo CSV de tradução inválido;

classe retornada pelo modelo sem tradução correspondente.

O aplicativo não deve quebrar caso uma tradução não seja encontrada.

Nesse caso, utilizar a classe original.

11. Arquitetura

Priorizar uma implementação simples.

Preferência por:

Frontend:

React

TypeScript

Tailwind CSS

Inferência:

ONNX Runtime Web

A inferência deve ocorrer no navegador sempre que possível, sem necessidade de enviar as imagens para um servidor.

Não criar autenticação, banco de dados, sistema de usuários ou dashboard administrativo neste primeiro momento.

O objetivo é apenas criar uma ferramenta simples para carregar um modelo ONNX e classificar imagens.

12. Cuidados importantes

Não presumir que a saída do modelo sempre será exatamente um array simples de classes.

Criar uma camada de processamento da saída que permita trabalhar com modelos de classificação comuns.

Se o modelo possuir uma saída de logits/probabilidades, aplicar o processamento necessário para obter a classe e a confiança.

A confiança apresentada deve ser a probabilidade/confiança correspondente à classe prevista.

Se for necessário aplicar Softmax aos logits, fazer isso corretamente antes de calcular a confiança.

13. Experiência desejada

O fluxo ideal deve ser:

Usuário abre o aplicativo.

Carrega modelo.onnx.

O sistema informa "Modelo carregado".

Usuário define, por exemplo, 80% de confiança.

Opcionalmente carrega traducoes.csv.

Seleciona 10 imagens.

Clica em "Classificar imagens".

O sistema processa as imagens.

Cada imagem mostra sua classificação e confiança.

Resultados abaixo de 80% são identificados como "confiança insuficiente".

Classes em inglês são exibidas traduzidas quando houver correspondência no CSV.

14. Escopo

Manter o projeto simples.

Não adicionar funcionalidades que não foram solicitadas.

O objetivo é construir primeiro um MVP funcional, organizado e fácil de utilizar.

Depois que o MVP estiver funcionando, a estrutura deve permitir adicionar novas funcionalidades futuramente sem precisar refazer o projeto inteiro.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/767baa33-262d-41ed-a7ff-6bf04ac7a2c3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
