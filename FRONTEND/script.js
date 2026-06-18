async function generateAvatar() {

    const prompt =
    document.getElementById("prompt").value;

    const style =
    document.getElementById("style").value;

    const response =
    await fetch(
      "http://localhost:5000/avatar/generate",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          prompt,
          style
        })
      }
    );

    const data =
    await response.json();

    document
    .getElementById("result")
    .src = data.image;
}