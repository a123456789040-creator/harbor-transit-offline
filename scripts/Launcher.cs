using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

class Launcher : Form {
    Process server;
    readonly bool smoke;
    string url;
    readonly Label status = new Label();
    readonly Button open = new Button();
    Launcher(bool smokeTest) {
        smoke = smokeTest;
        Text = "河港路網 · 離線版";
        ClientSize = new Size(460, 220);
        AutoScaleMode = AutoScaleMode.Dpi;
        Font = new Font("Microsoft JhengHei UI", 10);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        var title = new Label { Text="河港路網 Harbor Transit", Font=new Font(Font.FontFamily,17,FontStyle.Bold), Location=new Point(24,22), AutoSize=true };
        status.Location = new Point(24,70); status.Size = new Size(410,75); status.Text = "正在啟動離線遊戲…";
        open.Text="開啟遊戲"; open.Location=new Point(24,160); open.Size=new Size(190,36); open.Enabled=false;
        open.Click += (s,e) => OpenGame();
        var close = new Button { Text="結束程式", Location=new Point(234,160), Size=new Size(190,36) };
        close.Click += (s,e) => Close();
        Controls.AddRange(new Control[]{title,status,open,close});
        Shown += (s,e) => StartGame();
        FormClosed += (s,e) => StopServer();
    }
    void OpenGame() { try { Process.Start(new ProcessStartInfo(url) { UseShellExecute=true }); } catch(Exception e) { MessageBox.Show(this,e.Message,Text); } }
    void StartGame() {
        try {
            string root=AppDomain.CurrentDomain.BaseDirectory;
            var start = new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),"server.mjs") { WorkingDirectory=root,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true };
            start.EnvironmentVariables.Remove("NODE_OPTIONS");
            start.EnvironmentVariables["HARBOR_PORT"] = smoke?"0":"8837";
            server=Process.Start(start);
            var read=server.StandardOutput.ReadLineAsync();
            if(!read.Wait(15000))throw new Exception("離線服務啟動逾時。");
            url=read.Result;
            if(url==null||!url.StartsWith("http://127.0.0.1:"))throw new Exception(server.StandardError.ReadToEnd());
            var request=(HttpWebRequest)WebRequest.Create(url+"health"); request.Proxy=null; request.Timeout=5000;
            using(var response=request.GetResponse()) using(var reader=new StreamReader(response.GetResponseStream())) {
                if(!reader.ReadToEnd().Contains("harbor-transit-offline"))throw new Exception("離線服務驗證失敗。");
            }
            status.Text="已就緒，完全由本機載入。\n"+url+"\n遊玩時保持本視窗開啟；結束程式會停止服務。";
            open.Enabled=true;
            if(smoke) { Console.WriteLine("OFFLINE_LAUNCHER_OK"); Close(); } else OpenGame();
        } catch(Exception e) { Environment.ExitCode=1; status.Text="無法啟動："+e.Message; if(smoke)Close(); }
    }
    void StopServer() { try { if(server!=null&&!server.HasExited) { server.Kill(); server.WaitForExit(5000); } } catch {} if(server!=null)server.Dispose(); }
    [STAThread] static void Main(string[] args) {
        bool smoke=Array.IndexOf(args,"--smoke")>=0;
        bool owned;
        using(var mutex=new Mutex(true,smoke?"HarborTransitOfflineSmoke":"HarborTransitOffline",out owned)) {
            if(!owned) { if(!smoke)MessageBox.Show("離線程式已開啟，請使用原本的視窗。","河港路網"); return; }
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false); Application.Run(new Launcher(smoke));
        }
    }
}
