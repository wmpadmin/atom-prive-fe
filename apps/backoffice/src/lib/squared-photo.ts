/** As big as any avatar the platform draws, and twice over for a retina screen. The server squares to the same. */
const SIDE = 256;

/**
 * A photograph, squared in the browser before it is sent anywhere.
 *
 * <p>Done here, not only on the server, because two of the forms that offer a photograph carry it in the
 * body they already send — a client being onboarded and a member of staff being added both have no record
 * yet to upload one against. A phone's photograph is several megabytes, and several megabytes inside a form
 * body is a form that fails to save. The server squares it again whatever arrives: this is for the wire, not
 * for trust.
 *
 * <p>Cut from the middle rather than squashed, the way the server does it, so what is previewed here is what
 * ends up on the record.
 */
export function squared(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That photo couldn't be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("That file isn't a picture this can read."));
      image.onload = () => {
        const side = Math.min(image.width, image.height);
        const canvas = document.createElement("canvas");
        canvas.width = SIDE;
        canvas.height = SIDE;
        const pen = canvas.getContext("2d");
        if (!pen) {
          reject(new Error("That photo couldn't be prepared."));
          return;
        }
        // White underneath, so a cut-out PNG does not come back black once it is a JPEG.
        pen.fillStyle = "#ffffff";
        pen.fillRect(0, 0, SIDE, SIDE);
        pen.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
