"use client";

export default function Page() {

  async function login() {
    try {
      const res = await fetch("/api/bankid/auth", {
        method: "POST"
      });

      if (!res.ok) {
        const error = await res.json();
        console.error("Login failed:", error);
        alert(`Login failed: ${error.error}`);
        return;
      }

      const data = await res.json();

      listen(data.orderRef);

      // eslint-disable-next-line react-hooks/immutability
      window.location.href = data.redirectUrl;
    } catch (error) {
      console.error("Login error:", error);
      alert("An error occurred during login");
    }
  }

  function listen(orderRef: string) {

    const source = new EventSource(`/api/bankid/events/${orderRef}`);

    source.onmessage = (event) => {
      const status = JSON.parse(event.data);
      console.log("BankID status:", status);
    };
  }

  return (
    <button
      onClick={login}
      className="bg-[#235971] text-white border-none rounded-lg px-6 py-3 text-sm font-semibold cursor-pointer hover:bg-[#1a4557] transition-colors"
    >
      Login with BankID
    </button>
  );
}
