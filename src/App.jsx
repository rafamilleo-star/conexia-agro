
  const saveObjectivesFix = async () => {
    if (!user || objectivesFixSel.length === 0) return;
    setObjectivesFixBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ objectives: objectivesFixSel }).eq("id", user.id);
      if (error) {
        console.error("[ObjectivesFix]", error);
        setObjectivesFixBusy(false);
        return;
      }
      setProfile(prev => ({ ...(prev || {}), objectives: objectivesFixSel }));
      setNeedsObjectivesFix(false);
    } catch (e) {
      console.error("[ObjectivesFix]", e);
    }
    setObjectivesFixBusy(false);
  };


  // Splash aparece imediatamente na primeira abertura, independente do estado de auth
  if (!splashShown) return <SplashScreen onDone={() => setSplashShown(true)} />;


  if (state === "loading") return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:44, height:44, borderRadius:11, background:`linear-gradient(135deg,${C.gold},${C.gB})`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.bg }}>C</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:C.gold, letterSpacing:".06em" }}>{BRAND.name}</div>
      <div style={{ width:32, height:2, borderRadius:1, background:C.gD, animation:"none", marginTop:4 }}/>
      <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, letterSpacing:".08em" }}>Verificando acesso...</div>
    </div>
  );


  return (
    <>
      {needsConsent && user && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:24, maxWidth:480, width:"100%", maxHeight:"85vh", overflowY:"auto" }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.txt, margin:"0 0 6px" }}>Atualizamos nossa Política de Privacidade</h2>
            <p style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, marginBottom:16, lineHeight:1.6 }}>Pra continuar usando o {BRAND.name}, precisamos que você confirme sua ciência sobre o tratamento dos seus dados, conforme a LGPD.</p>
            <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, lineHeight:1.7, marginBottom:16 }}>
              <p><strong style={{color:C.txt}}>1. Responsável pelo tratamento</strong><br/>{BRAND.name}, plataforma de inteligência relacional para profissionais do agronegócio.</p>
              <p><strong style={{color:C.txt}}>2. Dados coletados</strong><br/>Nome, e-mail, empresa, cargo, WhatsApp, LinkedIn, Instagram, cidade, estado, objetivos profissionais e histórico de interações com contatos.</p>
              <p><strong style={{color:C.txt}}>3. Finalidade</strong><br/>Personalizar os insights de inteligência relacional, gerar diagnósticos e recomendações dentro da plataforma.</p>
              <p><strong style={{color:C.txt}}>4. Base legal (LGPD — Lei 13.709/2018)</strong><br/>Consentimento do titular (Art. 7º, I) e execução do contrato de uso da plataforma (Art. 7º, V).</p>
              <p><strong style={{color:C.txt}}>5. Compartilhamento</strong><br/>Seus dados não são vendidos ou compartilhados com terceiros. Utilizamos provedores de infraestrutura (Supabase, Vercel, Google Gemini) sob acordos de confidencialidade.</p>
              <p><strong style={{color:C.txt}}>6. Seus direitos</strong><br/>Acesso, correção, exclusão ou portabilidade dos seus dados a qualquer momento: <strong>{BRAND.supportEmail}</strong>.</p>
            </div>
            <button onClick={acceptConsentNow} disabled={consentBusy} style={{ width:"100%", background:`linear-gradient(135deg,${C.gold},${C.gB})`, border:"none", borderRadius:10, padding:"12px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, color:C.bg, cursor:"pointer" }}>{consentBusy ? "Aguarde..." : "Li e aceito"}</button>
          </div>
        </div>
      )}
      {needsObjectivesFix && user && !needsConsent && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:99998, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:24, maxWidth:480, width:"100%", maxHeight:"85vh", overflowY:"auto" }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.txt, margin:"0 0 6px" }}>Só falta um detalhe</h2>
            <p style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, marginBottom:16, lineHeight:1.6 }}>Seus objetivos de networking não foram salvos por uma falha técnica. Selecione de novo pra deixar seu diagnóstico completo.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
              {OBJECTIVES.map(o => {
                const sel = objectivesFixSel.includes(o.value);
                return (
                  <button key={o.value} onClick={() => setObjectivesFixSel(p => p.includes(o.value) ? p.filter(x => x !== o.value) : [...p, o.value])} style={{ background: sel ? C.gD : C.sf, border: `1px solid ${sel ? C.gL : C.brd}`, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{o.icon}</span>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? C.gold : C.txM }}>{o.label}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={saveObjectivesFix} disabled={objectivesFixBusy || objectivesFixSel.length === 0} style={{ width:"100%", background:`linear-gradient(135deg,${C.gold},${C.gB})`, border:"none", borderRadius:10, padding:"12px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, color:C.bg, cursor:"pointer", opacity: objectivesFixSel.length === 0 ? 0.6 : 1 }}>{objectivesFixBusy ? "Salvando..." : "Salvar e continuar"}</button>
          </div>
        </div>
      )}
      {state === "reset_password" && <ResetPassword onDone={handlePasswordUpdated} />}
      {state === "landing"      && <PublicLanding onSignup={() => setState("auth_signup")} onLogin={() => setState("auth_login")} urlKey={urlKey} />}
      {state === "auth_signup"  && <Auth onAuth={handleAuth} initialMode="signup" />}
      {state === "auth_login"   && <Auth onAuth={handleAuth} initialMode="login" />}
      {state === "onboard"      && user && (
        <Onboard
          onDone={handleOnboard}
          initialKey={pendingKey}
          authEmail={user?.email || ""}
          authName={
            user?.user_metadata?.name ||
            profile?.first_name ||
            profile?.name ||
            ""
          }
        />
      )}
      {state === "assess"       && user && <Assess profile={profile} onDone={handleAssess} />}
      {state === "app"          && user && <CRM profile={profile} assessment={assessment} onReset={handleLogout} user={user} onProfileUpdate={(updated) => setProfile(prev => ({ ...(prev || {}), ...updated }))} />}
    </>
  );
}


export default App;
