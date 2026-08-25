# LESSONS - memoria institucional do projeto

Regras destiladas de falhas reais. Os agentes do forge leem este arquivo como insumo; uma regra daqui SOBREPOE o padrao do agente.

## 2026-08-25 - p2p-screen-share-mvp (+ quicks app-sounds-volume, hq-presets)

- Porta da sala sumia apos um tempo ("Sala nao encontrada" com codigo valido) -> o door peer nao tratava 'disconnected', so o member peer -> handlers de reconexao/saude de sinalizacao cobrem TODOS os peers do processo, nao so o principal.
- Toast falso de queda ao clicar em Sair -> destroy() emite 'disconnected' por dentro -> regra distribuida definida para QUEDA tambem precisa considerar a SAIDA VOLUNTARIA (flag disposing antes do destroy).
- Bug de campo so aparecia entrando na sala minutos depois de criada -> E2E so cobria criar-e-entrar imediato -> teste E2E precisa de pelo menos um cenario com atraso realista entre criar e entrar.
- Sala conectava num dia e noutro nao, entre as MESMAS maquinas -> desempate fixo (id lexicografico menor vence a corrida de dial) elegia sistematicamente a direcao de rede quebrada -> regra de desempate em sistema distribuido deve preferir O QUE COMPROVADAMENTE FUNCIONA (primeiro-que-abrir vence), com desempate deterministico so para empate real.
- Tela preta silenciosa na transmissao -> o evento 'stream' do PeerJS dispara na troca de SDP, ANTES do ICE completar -> receber o objeto de midia NAO prova midia fluindo: todo consumo de stream remota precisa de watchdog de connectionState/track muted com feedback visivel ao usuario.
- Diagnostico de bug multi-PC dependia de relato verbal dos amigos -> console do renderer se perde no app instalado -> logs persistentes em arquivo + botao "abrir logs" pagam o investimento na PRIMEIRA rodada de campo; instrumentar ANTES de tentar corrigir.
- Pull (chamada reversa) entregava video sem som -> a oferta ficticia do espectador so tinha m-line de video, e a resposta nao pode carregar track sem m-line correspondente -> oferta ficticia/placeholder em WebRTC precisa espelhar TODAS as midias que a resposta vai carregar (video E audio silencioso).
- Preset novo deixaria cliente antigo cego para a transmissao, sem erro nenhum -> validacao de payload com enum FECHADA descarta a mensagem inteira -> toda adicao de valor a um enum de protocolo exige investigar e DOCUMENTAR o comportamento do cliente antigo nas notas da release (ou abrir o validador para valores desconhecidos com degradacao).
- NAT assimetrico real: um lado recebia candidatos ICE mas nunca ENVIAVA os dele nas conexoes que iniciava -> conexoes P2P que so funcionam numa direcao EXISTEM em campo -> toda conexao iniciada (admissao, mesh, midia) precisa de um fallback na direcao oposta; sem TURN, essa e a unica rede de seguranca.
