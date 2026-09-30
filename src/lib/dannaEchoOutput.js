export function needsEchoOutput(nav = globalThis.navigator) {
  return Boolean(
    nav &&
      (
        /Android|iPhone|iPad|iPod/i.test(nav.userAgent || "") ||
        (
          /Macintosh/i.test(nav.userAgent || "") &&
          nav.maxTouchPoints > 1
        )
      )
  );
}

// Encaminha somente a voz sintetizada à saída WebRTC.
// O microfone não passa por estas conexões.
export default class DannaEchoOutput {
  constructor(context) {
    this.input = context.createMediaStreamDestination();

    this.audio = new Audio();
    this.audio.autoplay = true;
    this.audio.playsInline = true;
    this.audio.srcObject = this.input.stream;

    this.closed = false;
    this.sender = new RTCPeerConnection({ iceServers: [] });
    this.receiver = new RTCPeerConnection({ iceServers: [] });

    // Iniciado dentro do clique para liberar a reprodução.
    this.initialPlay = this.audio.play();
    this.initialPlay?.catch(() => {});
  }

  async open() {
    const sender = this.sender;
    const receiver = this.receiver;
    let timer;
    let fail;

    const failure = new Promise((_, reject) => {
      fail = reject;
    });

    this.fail = fail;

    const pending = new Map([
      [sender, []],
      [receiver, []],
    ]);

    const forward = async (peer, candidate) => {
      if (!candidate || this.closed) return;

      if (!peer.remoteDescription) {
        pending.get(peer).push(candidate);
      } else {
        await peer.addIceCandidate(candidate);
      }
    };

    sender.onicecandidate = event => {
      forward(receiver, event.candidate).catch(fail);
    };

    receiver.onicecandidate = event => {
      forward(sender, event.candidate).catch(fail);
    };

    const remotePlayback = new Promise((resolve, reject) => {
      receiver.ontrack = async event => {
        if (this.closed) return;

        this.audio.srcObject =
          event.streams[0] || new MediaStream([event.track]);

        try {
          await this.audio.play();
          resolve();
        } catch (error) {
          reject(error);
        }
      };
    });

    const connected = new Promise((resolve, reject) => {
      receiver.onconnectionstatechange = () => {
        if (receiver.connectionState === "connected") {
          resolve();
        }

        if (["failed", "closed"].includes(receiver.connectionState)) {
          reject(
            new Error("Não consegui preparar a saída de voz do celular.")
          );
        }
      };
    });

    const negotiate = async () => {
      sender.addTrack(
        this.input.stream.getAudioTracks()[0],
        this.input.stream
      );

      await sender.setLocalDescription(await sender.createOffer());

      if (this.closed) throw new Error("Abertura cancelada.");

      await receiver.setRemoteDescription(sender.localDescription);

      for (const candidate of pending.get(receiver).splice(0)) {
        await receiver.addIceCandidate(candidate);
      }

      await receiver.setLocalDescription(await receiver.createAnswer());

      if (this.closed) throw new Error("Abertura cancelada.");

      await sender.setRemoteDescription(receiver.localDescription);

      for (const candidate of pending.get(sender).splice(0)) {
        await sender.addIceCandidate(candidate);
      }

      await Promise.all([remotePlayback, connected]);

      return this;
    };

    remotePlayback.catch(fail);
    connected.catch(fail);

    try {
      timer = setTimeout(
        () => fail(
          new Error("A saída de áudio demorou para conectar.")
        ),
        10000
      );

      return await Promise.race([negotiate(), failure]);
    } catch (error) {
      this.close();
      throw error;
    } finally {
      clearTimeout(timer);
      this.fail = null;
    }
  }

  resume() {
    if (!this.closed) this.audio.muted = false;
  }

  interrupt() {
    if (!this.closed) this.audio.muted = true;
  }

  close() {
    if (this.closed) return;

    this.closed = true;
    this.fail?.(new Error("Abertura cancelada."));

    this.sender.onicecandidate = null;
    this.receiver.onicecandidate = null;
    this.receiver.ontrack = null;
    this.receiver.onconnectionstatechange = null;

    this.sender.close();
    this.receiver.close();

    this.audio.pause();
    this.audio.srcObject = null;

    this.input.stream.getTracks().forEach(track => track.stop());
    this.input.disconnect();
  }
}
