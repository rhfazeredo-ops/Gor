# Ampliar artes com IA (Real-ESRGAN anime 6B, sem PyTorch)

Telas de menu precisam estar na resolução do celular (ex.: 2400 px de largura para tela 20:9).
As imagens do ChatGPT vêm com ~1670 px; este ampliador recria detalhes em vez de só esticar.

    python3 -m venv /tmp/up && /tmp/up/bin/pip install onnx onnxruntime numpy pillow
    curl -L -o /tmp/anime6B.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth
    /tmp/up/bin/python tools/ampliar/build_onnx.py /tmp/anime6B.pth /tmp/anime6B.onnx
    /tmp/up/bin/python tools/ampliar/upscale.py /tmp/anime6B.onnx entrada.png saida.webp 2400

Larguras usadas: telas 16:9 que cobrem a tela (inicial, taverna, carregamento) 2400;
tela de Heróis 1920 (recortes na mesma proporção, ×1920/1672); quadro de missões 1920; papéis 900.
